import json

# Đọc file JSON
# Open and read the JSON file
with open('test/data.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# reverse=True thì là giảm dần
def sort_and_merge_data_by_price(data, reverse=False):
    # Tạo một danh sách để lưu tất cả các mục trong dữ liệu
    all_entries = []

    # Lặp qua từng symbol và order_id trong dữ liệu
    for symbol, orders in data.items():
        for order_id, entries in orders.items():
            for entry in entries:
                if 'parsed_message' in entry and 'Price' in entry['parsed_message']:
                    try:
                        # Thêm entry vào danh sách chung cùng với symbol và giá
                        price = float(entry['parsed_message']['Price'])
                        all_entries.append((symbol, entry, price))
                    except (ValueError, TypeError):
                        # Bỏ qua nếu không thể chuyển đổi 'Price' sang float
                        continue

    # Sắp xếp danh sách theo trường 'Price' trong 'parsed_message'
    sorted_entries = sorted(all_entries, key=lambda x: x[2], reverse=reverse)

    # Gom nhóm theo symbol
    sorted_data = {}
    for symbol, entry, _ in sorted_entries:
        sorted_data.setdefault(symbol, []).append(entry)
        
    return sorted_data

# Sắp xếp tăng dần (mặc định)
sorted_data_asc = sort_and_merge_data_by_price(data)

# Sắp xếp giảm dần
sorted_data_desc = sort_and_merge_data_by_price(data, reverse=True)

# Ghi lại file JSON đã sắp xếp giảm dần
with open('test/sort_desc.json', 'w', encoding='utf-8') as file:
    json.dump(sorted_data_desc, file, indent=4)
# Ghi lại file JSON đã sắp xếp tăng dần 
with open('test/sort_asc.json', 'w', encoding='utf-8') as file:
    json.dump(sorted_data_asc, file, indent=4)

print("File sort and save successfully!")