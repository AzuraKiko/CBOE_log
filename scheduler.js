const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Tạo thư mục logs nếu chưa tồn tại
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// CẤU HÌNH THỜI GIAN
const config = {
    startHour: 11,
    startMinute: 30,
    endHour: 11,
    endMinute: 45,
    specificDays: [],
    dayRange: { start: 3, end: 25 },
    specificMonths: [],
    daysOfWeek: [],
    maxRuns: 15,
    resetCountInterval: 30
};

// Biến đếm số lần chạy
let runCounter = 0;
let lastResetTime = new Date();
let isRunning = false; // Thêm flag để tránh chạy đồng thời

// DANH SÁCH CÁC FILE CẦN CHẠY
const scriptsToRun = [
    {
        name: "snapShot",
        path: path.join(__dirname, './authen/snapShot'),
        args: []
    }
];

// Hàm log với timestamp
function logWithTimestamp(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

// Hàm kiểm tra thời gian
function isWithinSchedule() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfMonth = now.getDate();
    const month = now.getMonth() + 1;
    const dayOfWeek = now.getDay();

    const isWithinTimeRange =
        (hour > config.startHour || (hour === config.startHour && minute >= config.startMinute)) &&
        (hour < config.endHour || (hour === config.endHour && minute < config.endMinute));

    const isSpecificDay = config.specificDays.length === 0 ||
        config.specificDays.includes(dayOfMonth);

    const isWithinDayRange = config.dayRange === null ||
        (dayOfMonth >= config.dayRange.start &&
            dayOfMonth <= config.dayRange.end);

    const isSpecificMonth = config.specificMonths.length === 0 ||
        config.specificMonths.includes(month);

    const isSpecificDayOfWeek = config.daysOfWeek.length === 0 ||
        config.daysOfWeek.includes(dayOfWeek);

    return isWithinTimeRange && isSpecificDay && isWithinDayRange &&
        isSpecificMonth && isSpecificDayOfWeek;
}

// Hàm kiểm tra và reset bộ đếm
function checkAndResetRunCounter() {
    const now = new Date();
    const minutesPassed = Math.floor((now - lastResetTime) / (1000 * 60));

    if (minutesPassed >= config.resetCountInterval) {
        logWithTimestamp(`Resetting run counter after ${minutesPassed} minutes. Previous count: ${runCounter}`);
        runCounter = 0;
        lastResetTime = now;
    }

    return runCounter < config.maxRuns;
}

// Hàm chạy script với timeout
function runScript(script, timeout = 300000) { // 5 phút timeout
    return new Promise((resolve, reject) => {
        const args = script.args || [];
        const command = `node ${script.path} ${args.join(' ')}`.trim();

        logWithTimestamp(`Executing: ${command}`);

        const childProcess = exec(command, {
            timeout: timeout,
            killSignal: 'SIGTERM'
        }, (error, stdout, stderr) => {
            if (error) {
                logWithTimestamp(`Error running ${script.name}: ${error.message}`, 'ERROR');
                reject(error);
                return;
            }

            if (stderr) {
                logWithTimestamp(`${script.name} stderr: ${stderr}`, 'WARN');
            }

            logWithTimestamp(`${script.name} completed successfully`);
            resolve(stdout);
        });

        // Xử lý timeout
        setTimeout(() => {
            if (!childProcess.killed) {
                logWithTimestamp(`Script ${script.name} timeout, killing process`, 'WARN');
                childProcess.kill('SIGTERM');
            }
        }, timeout);
    });
}

// Hàm chạy tất cả scripts
async function runAllScripts() {
    if (isRunning) {
        logWithTimestamp('Scripts are already running, skipping this execution', 'WARN');
        return;
    }

    isRunning = true;

    try {
        logWithTimestamp(`Starting all scripts - Run count: ${runCounter + 1}/${config.maxRuns}`);
        runCounter++;

        for (const script of scriptsToRun) {
            try {
                logWithTimestamp(`Starting script: ${script.name}`);
                await runScript(script);

                // Delay giữa các script
                if (scriptsToRun.indexOf(script) < scriptsToRun.length - 1) {
                    logWithTimestamp('Waiting 1 minute before next script...');
                    await new Promise(resolve => setTimeout(resolve, 1 * 60 * 1000));
                }
            } catch (error) {
                logWithTimestamp(`Script ${script.name} failed: ${error.message}`, 'ERROR');
            }
        }

        logWithTimestamp('All scripts execution completed');
    } catch (error) {
        logWithTimestamp(`Error in script execution: ${error.message}`, 'ERROR');
    } finally {
        isRunning = false;
    }
}

// Xử lý graceful shutdown
process.on('SIGINT', () => {
    logWithTimestamp('Received SIGINT, shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logWithTimestamp('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

// Lập lịch chạy mỗi phút
const task = cron.schedule('* * * * *', async () => {
    try {
        if (isWithinSchedule() && checkAndResetRunCounter()) {
            await runAllScripts();
        } else if (isWithinSchedule() && !checkAndResetRunCounter()) {
            logWithTimestamp(`Maximum runs (${config.maxRuns}) reached. Waiting for reset after ${config.resetCountInterval} minutes`, 'WARN');
        }
    } catch (error) {
        logWithTimestamp(`Error in cron task: ${error.message}`, 'ERROR');
    }
}, {
    scheduled: true,
    timezone: "Asia/Ho_Chi_Minh" // Đặt timezone phù hợp
});

// Khởi động
logWithTimestamp('Multi-file cron job scheduler started with PM2');
logWithTimestamp(`Schedule: ${config.startHour}:${config.startMinute} - ${config.endHour}:${config.endMinute}`);
logWithTimestamp(`Maximum ${config.maxRuns} runs allowed every ${config.resetCountInterval} minutes`);
logWithTimestamp(`Day range: ${config.dayRange ? `${config.dayRange.start}-${config.dayRange.end}` : 'All days'}`);

// Export cho PM2
module.exports = { task, config };
