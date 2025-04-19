const axios = require('axios');
const { updateTokens } = require("./refreshToken");
const { urlRealtimeCXA } = require("./config");
const { saveFile } = require("../saveFile.js");

let tokens = {};
let logData = [];
let processedIds = new Set(); // Add this to track which messages we've already processed


/**
 * Stream data from the API with a time limit option
 * @param {string} url - API endpoint URL
 * @param {string} token - Authentication token
 * @param {Function} onDataCallback - Callback for new data
 * @param {number|null} logDuration - Duration in milliseconds to collect data (null for unlimited)
 */
async function streamLatestResponse(url, token, onDataCallback, logDuration = null) {
    let logEndTime = null;
    let streamController = null;

    if (logDuration) {
        logEndTime = new Date(Date.now() + logDuration);
        console.log(`Starting log capture for ${logDuration / 1000} seconds`);
    } else {
        console.log('Starting log capture (unlimited duration)');
    }

    try {
        // Create AbortController to be able to stop the stream
        streamController = new AbortController();

        // Gửi request với response dạng stream
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            responseType: 'stream',
            signal: streamController.signal
        });

        // Sử dụng buffer để xử lý dữ liệu có thể bị chia cắt
        let buffer = '';

        // Đọc dữ liệu từ stream
        response.data.on('data', (chunk) => {
            // Check if we should stop logging based on duration
            if (logEndTime && new Date() > logEndTime) {
                console.log('Log duration reached, stopping capture');
                streamController.abort();
                return;
            }

            const text = chunk.toString();
            buffer += text;

            // Tìm các sự kiện SSE hoàn chỉnh
            const pattern = /data:\s*({.*?})\s*(?=data:|$)/gs;
            let match;

            while ((match = pattern.exec(buffer)) !== null) {
                try {
                    const jsonStr = match[1];
                    const jsonData = JSON.parse(jsonStr);

                    // Skip ping messages
                    if (isPingMessage(jsonData)) {
                        // Optionally log to console that we received a ping
                        console.log("Received ping message (not saving)");
                        continue;
                    }

                    // Gọi callback khi có dữ liệu mới
                    if (onDataCallback) {
                        onDataCallback(jsonData);
                    }
                } catch (err) {
                    console.error('Lỗi khi phân tích JSON:', err.message);
                }
            }

            // Giữ lại phần cuối có thể chưa hoàn chỉnh
            const lastDataIndex = buffer.lastIndexOf('data:');
            if (lastDataIndex !== -1) {
                buffer = buffer.substring(lastDataIndex);
                if (buffer.length > 10000) {
                    buffer = buffer.substring(buffer.length - 10000);
                }
            } else {
                buffer = '';
            }
        });

        // Xử lý khi kết thúc stream
        response.data.on('end', () => {
            console.log('Kết thúc stream.');
        });

        // Xử lý lỗi trong quá trình stream
        response.data.on('error', (err) => {
            console.error('Lỗi trong quá trình stream:', err.message);
        });

        return streamController; // Return controller to allow manual abort
    } catch (error) {
        console.error('Lỗi khi gửi request:', error.message);
        if (error.response) {
            console.error('Chi tiết lỗi:', error.response.status, error.response.statusText);
        }
        return null;
    }
}

/**
 * Check if a message is a ping message
 * @param {Object} message - The message to check
 * @returns {boolean} - True if it's a ping message
 */
function isPingMessage(message) {
    return (
        message.type === "PING" &&
        message.id === "PING" &&
        message.data &&
        message.data.ping !== undefined
    );
}

// const processData = async (logDuration = null) => {
//     const currentTime = Date.now();
//     const logFileName = `./result/realtime_${currentTime}.json`;

//     // Reset log data for new session
//     logData = [];

//     processedIds = new Set(); // Reset processed IDs for new session


//     // Define callback function to process and save data
//     const dataCallback = (jsonData) => {
//         console.log(JSON.stringify(jsonData)); // Log to console

//         // Add to log data with timestamp
//         logData.push({
//             timestamp: Date.now(),
//             data: jsonData
//         });

//         // Save to file after each update
//         saveFile(JSON.stringify(logData, null, 2), logFileName);
//     };

//     // Start streaming with the specified duration
//     await streamLatestResponse(
//         urlRealtimeCXA,
//         tokens.tokenCXA,
//         dataCallback,
//         logDuration
//     );
// };


const processData = async (logDuration = null) => {
    const currentTime = Date.now();
    const logFileName = `./result/realtime_${currentTime}.json`;

    // Reset log data for new session
    logData = [];
    processedIds = new Set(); // Reset processed IDs for new session

    // Define callback function to process and save data
    const dataCallback = (jsonData) => {
        console.log(JSON.stringify(jsonData)); // Log to console

        // Check if this message has a unique identifier we can use to detect duplicates
        const messageId = JSON.stringify(jsonData);

        // Only process this message if we haven't seen it before
        if (!processedIds.has(messageId)) {
            processedIds.add(messageId);

            // Add to log data with timestamp
            logData.push({
                timestamp: Date.now(),
                data: jsonData
            });

            // Save to file after each update
            saveFile(JSON.stringify(logData, null, 2), logFileName);
        } else {
            console.log("Skipping duplicate message");
        }
    };

    // Start streaming with the specified duration
    await streamLatestResponse(
        urlRealtimeCXA,
        tokens.tokenCXA,
        dataCallback,
        logDuration
    );
};

// Hàm chính để cập nhật token và chạy processData
const startProcessing = async (logDuration = null) => {
    try {
        tokens = await updateTokens();
        if (Object.keys(tokens).length > 0) {
            await processData(logDuration);
        } else {
            console.error("Không nhận được token hợp lệ.");
        }
    } catch (error) {
        console.error("Lỗi khi cập nhật token:", error.message);
    }
};

// Chạy trực tiếp
(async () => {
    // Ví dụ: Log trong 10 phút (600000 ms)
    // Để log không giới hạn thời gian, gọi không có tham số
    const TEN_MINUTES = 1 * 60 * 1000;
    await startProcessing(TEN_MINUTES);
})();
