// Compare ko thêm cột
const compareObjects = (obj1, obj2, columnNames) => {
    let result = [];

    // Đặt tên cột mặc định
    const defaultColumnNames = {
        fieldName: "Field Name",
        compareValue: "Compare Value",
        expectedValue: "Expected Value",
        matchResult: "Match Result",
    };

    // Merge tên cột tùy chỉnh với mặc định
    columnNames = { ...defaultColumnNames, ...columnNames };

    // Lấy danh sách các key có chung giữa obj1 và obj2
    // let commonKeys = Object.keys(obj1).filter(key => Object.keys(obj2).includes(key));

    // Lấy all key obj1 và obj2
    let commonKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    // const requiredKeys = ["exchange", "depth", "trades"];
    // commonKeys = Array.from(commonKeys).filter(key =>
    //     requiredKeys.some(requiredKey => key.includes(requiredKey))
    // );

    // commonKeys = Array.from(commonKeys).filter(key => 
    //     !requiredKeys.some(requiredKey => key.includes(requiredKey))
    // );

    // Lọc các key mà chỉ có trong obj1 nhưng không có trong obj2
    // let commonKeys = Object.keys(obj1).filter(key => !obj2.hasOwnProperty(key));

    // console.log(commonKeys);

    // So sánh từng key chung
    commonKeys.forEach(key => {
        result.push({
            [columnNames.fieldName]: key,
            [columnNames.compareValue]: obj1[key],
            [columnNames.expectedValue]: obj2[key],
            [columnNames.matchResult]: obj1[key] === obj2[key] ? "✅" : "❌"
        });
    });
    console.table(result);
    // console.table(result.filter((r) => r[columnNames.matchResult] === "❌"));

    return result;
};

module.exports = { compareObjects };