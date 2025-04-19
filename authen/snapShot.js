const { updateTokens } = require("./refreshToken.js");
const { urlSnapCXA } = require("./config.js");
const { saveFile } = require("../saveFile.js");
// Import required modules
const axios = require("axios");

const getPrice = async (url, token) => {
  try {
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    });
    return response.data;
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    throw error;
  }
};

// Update token
(async () => {
  try {
    // Cập nhật token bằng Object Destructuring

    tokens = await updateTokens();

    // Kiểm tra nếu đã có token hợp lệ thì gọi các hàm xử lý
    if (Object.keys(tokens).length > 0) {
      const dataCXA = await getPrice(urlSnapCXA, tokens.tokenCXA);
      dataCXA[0].time = Date.now();
      saveFile(JSON.stringify(dataCXA, null, 2), `./result/snap_${dataCXA[0].time}.json`);
    } else {
      console.error("Không nhận được token hợp lệ.");
    }
  } catch (error) {
    console.error("Error khi cập nhật token:", error.message);
  }
})();