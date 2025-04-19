const fs = require("fs");
const path = require("path");

// Save file
const saveFile = (content, relativePath) => {
    // Lấy đường dẫn đầy đủ của tệp
    const filePath = path.resolve(__dirname, relativePath);
    // Lấy đường dẫn thư mục chứa tệp
    const dirPath = path.dirname(filePath);
    
    // Kiểm tra và tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    try {
        fs.writeFileSync(filePath, content, "utf8");
        console.log(`File "${relativePath}" has been saved.`);
    } catch (error) {
        console.error("Error saving file:", error);
    }
};

module.exports = { saveFile };
