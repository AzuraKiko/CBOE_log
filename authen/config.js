const ENV = "tfg"; // Can be changed to 'dev', 'uat', or 'prod' as needed
const symbol = "ALL";

// Base URLs for different environments
const BASE_URLS = {
    dev: "dev2-retail-api.equix.app",
    uat: "ausiex-uat-operator-api.equix.app",
    prod: "ausiex-prod-operator-api.equix.app", // Added production URL
    tfg: "equix-uat-retail-api.equix.app",
    tfg2: "ausiex-uat-operator-api.equix.app"
};

// Realtime URLs for different environments
const REALTIME_URLS = {
    dev: "dev2-market-feed.equix.app",
    uat: "ausiex-uat-market-feed.equix.app",
    prod: "ausiex-prod-market-feed.equix.app",// Added production URL
    tfg: "equix-uat-market-feed.equix.app",
    tfg2: "ausiex-uat-market-feed.equix.app"
};

// Device IDs for different environments
const DEVICE_IDS = {
    dev: "26113385-2303-4ed7-aec0-bb865a432d1d",
    uat: "78e0dd88-890c-4faa-8893-62af8c92aad0",
    prod: "00000000-0000-0000-0000-000000000000", // Replace with actual production device ID
    tfg: "a0a00264-1fca-4301-9a60-3171773d739b",
    tfg2: "78e0dd88-890c-4faa-8893-62af8c92aad0"
};

// Refresh tokens for different environments
const REFRESH_TOKENS = {
    uat: {
        ASX: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50ZmcyQGVxdWl4LmNvbS5hdSIsInN1YiI6ImVxMTc0MDQwNTkxMzQxMyIsInNlc3Npb25faWQiOiI4YTE1YTY2Mi1hZTcwLTRhZTAtOGFmMy0yZGNiNDc3Nzk2OTQiLCJleHAiOjE3NzE5NDE5NTMuOTQ4LCJpYXQiOjE3NDA0MDU5NTN9.TJsfFRIFZApzEun9GUMeiG1AiFOZH8RVoet6M_k_Kjs",
        CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50ZmcyQGVxdWl4LmNvbS5hdSIsInN1YiI6ImVxMTc0MDQwNTkxMzQxMyIsInNlc3Npb25faWQiOiI4YTE1YTY2Mi1hZTcwLTRhZTAtOGFmMy0yZGNiNDc3Nzk2OTQiLCJleHAiOjE3NzE5NDE5NTMuOTQ4LCJpYXQiOjE3NDA0MDU5NTN9.TJsfFRIFZApzEun9GUMeiG1AiFOZH8RVoet6M_k_Kjs",
        ASX_CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50ZmcyQGVxdWl4LmNvbS5hdSIsInN1YiI6ImVxMTc0MDQwNTkxMzQxMyIsInNlc3Npb25faWQiOiI4YTE1YTY2Mi1hZTcwLTRhZTAtOGFmMy0yZGNiNDc3Nzk2OTQiLCJleHAiOjE3NzE5NDE5NTMuOTQ4LCJpYXQiOjE3NDA0MDU5NTN9.TJsfFRIFZApzEun9GUMeiG1AiFOZH8RVoet6M_k_Kjs"
    },
    dev: {
        ASX: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50cmFuYXN4X2N4YUBlcXVpeC5jb20uYXUiLCJzdWIiOiJlcTE3NDAyMDY4NzMwNDAiLCJzZXNzaW9uX2lkIjoiYjJlZjRmZTgtNWQ3YS00Y2M1LTgxMzQtMmZhZWViOWE1YjUxIiwiZXhwIjoxNzcxNzQzNzQyLjk2MywiaWF0IjoxNzQwMjA3NzQyfQ.xmacSVdqlG0CeZdXlqEpqYCNKg7f75GDTO9_Ocl-tho",
        CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50cmFuYXN4X2N4YUBlcXVpeC5jb20uYXUiLCJzdWIiOiJlcTE3NDAyMDY4NzMwNDAiLCJzZXNzaW9uX2lkIjoiYjJlZjRmZTgtNWQ3YS00Y2M1LTgxMzQtMmZhZWViOWE1YjUxIiwiZXhwIjoxNzcxNzQzNzQyLjk2MywiaWF0IjoxNzQwMjA3NzQyfQ.xmacSVdqlG0CeZdXlqEpqYCNKg7f75GDTO9_Ocl-tho",
        ASX_CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50cmFuYXN4X2N4YUBlcXVpeC5jb20uYXUiLCJzdWIiOiJlcTE3NDAyMDY4NzMwNDAiLCJzZXNzaW9uX2lkIjoiYjJlZjRmZTgtNWQ3YS00Y2M1LTgxMzQtMmZhZWViOWE1YjUxIiwiZXhwIjoxNzcxNzQzNzQyLjk2MywiaWF0IjoxNzQwMjA3NzQyfQ.xmacSVdqlG0CeZdXlqEpqYCNKg7f75GDTO9_Ocl-tho"
    },
    prod: {
        ASX: "", // Add production refresh token when available
        CXA: "", // Add production refresh token when available
        ASX_CXA: "" // Add production refresh token when available
    },
    tfg: {
        ASX: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJxdXluaC5idWlAZXF1aXguY29tLmF1Iiwic3ViIjoiZXExNzQzNTAwMDc4MDk5Iiwic2Vzc2lvbl9pZCI6IjBkNzdiYWNiLTIyNmUtNDAxZi05ZjlmLWFhZWMyMDBhNDI2MyIsImV4cCI6MTc3NTAzNjE0My4zNzUsImlhdCI6MTc0MzUwMDE0M30.NjC21lm383o3wgYDJBdqZUQDkUEOE_kfmx3MnwhZkBg",
        CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJxdXluaC5idWlAZXF1aXguY29tLmF1Iiwic3ViIjoiZXExNzQzNTAwMDc4MDk5Iiwic2Vzc2lvbl9pZCI6IjBkNzdiYWNiLTIyNmUtNDAxZi05ZjlmLWFhZWMyMDBhNDI2MyIsImV4cCI6MTc3NTAzNjE0My4zNzUsImlhdCI6MTc0MzUwMDE0M30.NjC21lm383o3wgYDJBdqZUQDkUEOE_kfmx3MnwhZkBg",
        ASX_CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJxdXluaC5idWlAZXF1aXguY29tLmF1Iiwic3ViIjoiZXExNzQzNTAwMDc4MDk5Iiwic2Vzc2lvbl9pZCI6IjBkNzdiYWNiLTIyNmUtNDAxZi05ZjlmLWFhZWMyMDBhNDI2MyIsImV4cCI6MTc3NTAzNjE0My4zNzUsImlhdCI6MTc0MzUwMDE0M30.NjC21lm383o3wgYDJBdqZUQDkUEOE_kfmx3MnwhZkBg"
    },
    tfg2: {
        ASX: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50ZmcyQGVxdWl4LmNvbS5hdSIsInN1YiI6ImVxMTc0MDQwNTkxMzQxMyIsInNlc3Npb25faWQiOiI4YTE1YTY2Mi1hZTcwLTRhZTAtOGFmMy0yZGNiNDc3Nzk2OTQiLCJleHAiOjE3NzE5NDE5NTMuOTQ4LCJpYXQiOjE3NDA0MDU5NTN9.TJsfFRIFZApzEun9GUMeiG1AiFOZH8RVoet6M_k_Kjs",
        CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50ZmcyQGVxdWl4LmNvbS5hdSIsInN1YiI6ImVxMTc0MDQwNTkxMzQxMyIsInNlc3Npb25faWQiOiI4YTE1YTY2Mi1hZTcwLTRhZTAtOGFmMy0yZGNiNDc3Nzk2OTQiLCJleHAiOjE3NzE5NDE5NTMuOTQ4LCJpYXQiOjE3NDA0MDU5NTN9.TJsfFRIFZApzEun9GUMeiG1AiFOZH8RVoet6M_k_Kjs",
        ASX_CXA: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodXllbi50ZmcyQGVxdWl4LmNvbS5hdSIsInN1YiI6ImVxMTc0MDQwNTkxMzQxMyIsInNlc3Npb25faWQiOiI4YTE1YTY2Mi1hZTcwLTRhZTAtOGFmMy0yZGNiNDc3Nzk2OTQiLCJleHAiOjE3NzE5NDE5NTMuOTQ4LCJpYXQiOjE3NDA0MDU5NTN9.TJsfFRIFZApzEun9GUMeiG1AiFOZH8RVoet6M_k_Kjs"
    },

};

// Get configuration based on environment using switch-case
let BASE_URL, REALTIME_URL, deviceID, refreshToken_ASX, refreshToken_CXA, refreshToken_ASX_CXA;

switch (ENV) {
    case "dev":
        BASE_URL = BASE_URLS.dev;
        REALTIME_URL = REALTIME_URLS.dev;
        deviceID = DEVICE_IDS.dev;
        refreshToken_ASX = REFRESH_TOKENS.dev.ASX;
        refreshToken_CXA = REFRESH_TOKENS.dev.CXA;
        refreshToken_ASX_CXA = REFRESH_TOKENS.dev.ASX_CXA;
        break;
    case "uat":
        BASE_URL = BASE_URLS.uat;
        REALTIME_URL = REALTIME_URLS.uat;
        deviceID = DEVICE_IDS.uat;
        refreshToken_ASX = REFRESH_TOKENS.uat.ASX;
        refreshToken_CXA = REFRESH_TOKENS.uat.CXA;
        refreshToken_ASX_CXA = REFRESH_TOKENS.uat.ASX_CXA;
        break;
    case "prod":
        BASE_URL = BASE_URLS.prod;
        REALTIME_URL = REALTIME_URLS.prod;
        deviceID = DEVICE_IDS.prod;
        refreshToken_ASX = REFRESH_TOKENS.prod.ASX;
        refreshToken_CXA = REFRESH_TOKENS.prod.CXA;
        refreshToken_ASX_CXA = REFRESH_TOKENS.prod.ASX_CXA;
        break;
    case "tfg":
        BASE_URL = BASE_URLS.tfg;
        REALTIME_URL = REALTIME_URLS.tfg;
        deviceID = DEVICE_IDS.tfg;
        refreshToken_ASX = REFRESH_TOKENS.tfg.ASX;
        refreshToken_CXA = REFRESH_TOKENS.tfg.CXA;
        refreshToken_ASX_CXA = REFRESH_TOKENS.tfg.ASX_CXA;
        break;
    case "tfg2":
        BASE_URL = BASE_URLS.tfg2;
        REALTIME_URL = REALTIME_URLS.tfg2;
        deviceID = DEVICE_IDS.tfg2;
        refreshToken_ASX = REFRESH_TOKENS.tfg2.ASX;
        refreshToken_CXA = REFRESH_TOKENS.tfg2.CXA;
        refreshToken_ASX_CXA = REFRESH_TOKENS.tfg2.ASX_CXA;
        break;
    default:
        // Default to dev environment if ENV is not recognized
        BASE_URL = BASE_URLS.dev;
        REALTIME_URL = REALTIME_URLS.dev;
        deviceID = DEVICE_IDS.dev;
        refreshToken_ASX = REFRESH_TOKENS.dev.ASX;
        refreshToken_CXA = REFRESH_TOKENS.dev.CXA;
        refreshToken_ASX_CXA = REFRESH_TOKENS.dev.ASX_CXA;
}

module.exports = {
    urlRefresh: `https://${BASE_URL}/v1/auth/refresh`,
    urlSnapASX: `https://${BASE_URL}/v1/feed-snapshot-aio/price/ASX_ORIGIN/${symbol}`,
    urlDelayASX: `https://${BASE_URL}/v1/feed-delayed-snapshot-aio/price/ASX/${symbol}`,
    urlSnapCXA: `https://${BASE_URL}/v1/feed-snapshot-aio/price/CXA/${symbol}`,
    urlDelayCXA: `https://${BASE_URL}/v1/feed-delayed-snapshot-aio/price/CXA/${symbol}`,
    urlSnapAll: `https://${BASE_URL}/v1/feed-snapshot-aio/price/ASX/${symbol}`,
    urlDelayAll: `https://${BASE_URL}/v1/feed-delayed-snapshot-aio/price/ASX/${symbol}`,
    deviceID: deviceID,
    urlRealtimeASX: `https://${REALTIME_URL}/v1/price/${symbol}.ASX_ORIGIN`,
    urlRealtimeCXA: `https://${REALTIME_URL}/v1/price/${symbol}.CXA`,
    urlRealtimeAll: `https://${REALTIME_URL}/v1/price/${symbol}.ASX`,
    refreshToken_ASX: refreshToken_ASX,
    refreshToken_CXA: refreshToken_CXA,
    refreshToken_ASX_CXA: refreshToken_ASX_CXA,
};
