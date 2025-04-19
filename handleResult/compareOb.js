function compareObjs(obj1, obj2) {
  // Kiểm tra độ dài
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // Kiểm tra số lượng key
  if (keys1.length !== keys2.length) {
    console.log("Khác nhau về số lượng key:");
    console.log(`obj1 có ${keys1.length} key, obj2 có ${keys2.length} key`);
    return false;
  }
  // Lấy tất cả các giá trị và chuyển thành chuỗi JSON
  const values1 = Object.values(obj1).map(item => JSON.stringify(item));
  const values2 = Object.values(obj2).map(item => JSON.stringify(item));

  // So sánh từng phần tử
  let isEqual = true;
  // const differences = [];

  // for (let i = 0; i < values1.length; i++) {
  //   if (values1[i] !== values2[i]) {
  //     isEqual = false;
  //     differences.push({
  //       index: i,
  //       value1: JSON.parse(values1[i]),
  //       value2: JSON.parse(values2[i])
  //     });
  //   }
  // }

  // Kiểm tra các phần tử chỉ có trong obj1
  const uniqueToObj1 = values1.filter(val => !values2.includes(val));

  // Kiểm tra các phần tử chỉ có trong obj2
  const uniqueToObj2 = values2.filter(val => !values1.includes(val));

  // Hiển thị kết quả
  if (!isEqual) {
    // if (differences.length > 0) {
    //   differences.forEach(diff => {
    //     console.log(`Vị trí ${diff.index}:`);
    //     console.log("obj1:", diff.value1);
    //     console.log("obj2:", diff.value2);
    //     console.log("---");
    //   });
    // }

    if (uniqueToObj1.length > 0) {
      console.log("Các phần tử chỉ có trong obj1:");
      uniqueToObj1.forEach(val => console.log(JSON.parse(val)));
    }

    if (uniqueToObj2.length > 0) {
      console.log("Các phần tử chỉ có trong obj2:");
      uniqueToObj2.forEach(val => console.log(JSON.parse(val)));
    }
  } else {
    console.log("Hai đối tượng giống nhau.");
  }

  return isEqual;
}

module.exports = { compareObjs };