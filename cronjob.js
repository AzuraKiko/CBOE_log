const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

// CẤU HÌNH THỜI GIAN
const config = {
    // Giờ và phút (15:00 - 15:05)
    startHour: 11,
    startMinute: 30,
    endHour: 11,
    endMinute: 45,

    // Ngày trong tháng (để trống [] nếu muốn chạy mọi ngày)
    // Ví dụ: [1, 15, 20] - chỉ chạy vào ngày 1, 15 và 20 hàng tháng
    specificDays: [],

    // Khoảng ngày (từ ngày nào đến ngày nào trong tháng)
    // Ví dụ: { start: 5, end: 10 } - chạy từ ngày 5 đến ngày 10 hàng tháng
    // Đặt null nếu không sử dụng
    dayRange: { start: 3, end: 25 },

    // Tháng cụ thể (để trống [] nếu muốn chạy mọi tháng)
    // Tháng từ 1-12 (1 = tháng 1, 12 = tháng 12)
    specificMonths: [],

    // Ngày trong tuần (để trống [] nếu muốn chạy mọi ngày trong tuần)
    // 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7
    daysOfWeek: [], // Thứ 2, 4, 6

    // Cấu hình số lần chạy tối đa
    maxRuns: 15,               // Số lần chạy tối đa
    resetCountInterval: 30   // Thời gian để reset bộ đếm (phút)
};

// Biến đếm số lần chạy
let runCounter = 0;
let lastResetTime = new Date();

// DANH SÁCH CÁC FILE CẦN CHẠY
const scriptsToRun = [
    {
        name: "snapShot",
        path: path.join(__dirname, './authen/snapShot'),
        args: [] // Mảng rỗng nếu không có tham số
    }
    // Thêm các script khác nếu cần
];
// Hàm kiểm tra thời gian
function isWithinSchedule() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfMonth = now.getDate();
    const month = now.getMonth() + 1;
    const dayOfWeek = now.getDay();

    // Kiểm tra giờ và phút
    const isWithinTimeRange =
        (hour > config.startHour || (hour === config.startHour && minute >= config.startMinute)) &&
        (hour < config.endHour || (hour === config.endHour && minute < config.endMinute));

    // Kiểm tra ngày cụ thể
    const isSpecificDay = config.specificDays.length === 0 ||
        config.specificDays.includes(dayOfMonth);

    // Kiểm tra khoảng ngày
    const isWithinDayRange = config.dayRange === null ||
        (dayOfMonth >= config.dayRange.start &&
            dayOfMonth <= config.dayRange.end);

    // Kiểm tra tháng cụ thể
    const isSpecificMonth = config.specificMonths.length === 0 ||
        config.specificMonths.includes(month);

    // Kiểm tra ngày trong tuần
    const isSpecificDayOfWeek = config.daysOfWeek.length === 0 ||
        config.daysOfWeek.includes(dayOfWeek);

    return isWithinTimeRange && isSpecificDay && isWithinDayRange &&
        isSpecificMonth && isSpecificDayOfWeek;
}


// Hàm kiểm tra và reset bộ đếm số lần chạy
function checkAndResetRunCounter() {
    const now = new Date();
    const minutesPassed = Math.floor((now - lastResetTime) / (1000 * 60));

    if (minutesPassed >= config.resetCountInterval) {
        console.log(`Resetting run counter after ${minutesPassed} minutes. Previous count: ${runCounter}`);
        runCounter = 0;
        lastResetTime = now;
    }

    return runCounter < config.maxRuns;
}

// Hàm chạy một script
function runScript(script) {
    return new Promise((resolve, reject) => {
        // Đảm bảo script.args luôn tồn tại
        const args = script.args || [];
        const command = `node ${script.path} ${args.join(' ')}`.trim();
        console.log(`Executing: ${command}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error running ${script.name}: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr) {
                console.warn(`${script.name} stderr: ${stderr}`);
            }
            console.log(`${script.name} output: ${stdout}`);
            resolve(stdout);
        });
    });
}

// Hàm chạy tất cả scripts
async function runAllScripts() {
    console.log(`Starting all scripts at ${new Date().toISOString()}`);
    console.log(`Run count: ${runCounter + 1}/${config.maxRuns}`);
    runCounter++;

    try {
        //Phương pháp 1: Chạy tuần tự (đợi script này hoàn thành rồi mới chạy script tiếp theo)
        for (const script of scriptsToRun) {
            console.log(`Starting script: ${script.name}`);
            try {
                await runScript(script);
                console.log(`Script ${script.name} completed successfully`);
                // Thêm độ trễ giữa các script để tránh xung đột tài nguyên
                await new Promise(resolve => setTimeout(resolve, 1 * 60 * 1000));
            } catch (error) {
                console.error(`Script ${script.name} failed: ${error.message}`);
                // Tiếp tục với script tiếp theo ngay cả khi script này thất bại
            }
        }

        console.log(`All scripts completed at ${new Date().toISOString()}`);
    } catch (error) {
        console.error(`Error in script execution: ${error.message}`);
    }
}

// Lập lịch chạy mỗi phút
cron.schedule('* * * * *', () => {
    if (isWithinSchedule() && checkAndResetRunCounter()) {
        runAllScripts();
    } else if (isWithinSchedule() && !checkAndResetRunCounter()) {
        console.log(`Maximum number of runs (${config.maxRuns}) reached. Waiting for reset after ${config.resetCountInterval} minutes.`);
    }
});

console.log('Multi-file cron job scheduler started');
console.log(`Maximum ${config.maxRuns} runs allowed every ${config.resetCountInterval} minutes`);
