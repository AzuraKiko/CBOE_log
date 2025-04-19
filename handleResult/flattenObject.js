const flattenObject = (obj, prefix = "") => {
    let result = {};

    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (Array.isArray(obj[key])) {
            // Nếu là array của string thì gộp lại thành 1 chuỗi
            if (obj[key].every(item => typeof item === "string")) {
                result[fullKey] = obj[key];
            } else {
                obj[key].forEach((item, index) => {
                    Object.assign(result, flattenObject(item, `${fullKey}[${index}]`));
                });
            }
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
            Object.assign(result, flattenObject(obj[key], fullKey));
        } else {
            result[fullKey] = obj[key];
        }
    }
    
    return result;
};

module.exports = { flattenObject };