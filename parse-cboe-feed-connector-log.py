import os
import json
import re
import gzip
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from collections import defaultdict

FILTER_ONLY_EXECUTED = True
USE_SYMBOL_FILTER = True  # Set to False to disable symbol filtering
USE_TIME_FILTER = False  # Set to False to disable time filtering
USE_TIME_AND_PRICE_FILTER = False

GET_LOG_ORDER = True
GET_LOG_QUOTE = False

ORDER_MESSAGE_TYPES = ['AddOrderMessage', 'OrderExecutedMessage', 'ModifyOrderMessage', 'DeleteOrderMessage']
MESSAGE_TYPES = ['AuctionUpdateMessage']

symbol = ['BHP']  # Symbol to filter for
# Time range filter parameters 
START_TIME = 1744167695764000 
END_TIME = 1744167776676000  

# Hàm đọc dữ liệu từ file log và chuyển đổi JSON sang dictionary
# def load_log_data(file_path):
#     log_entries = []
#     if os.path.isfile(file_path) and file_path.endswith('.gz'):
#         print(f"Reading log file: {file_path}")
#         with gzip.open(file_path, 'rt') as file:
#             for line in file:
#                 log_entries.append(json.loads(line))
#     elif os.path.isfile(file_path) and file_path.endswith('.log'):
#         print(f"Reading log file: {file_path}")
#         with open(file_path, 'r') as file:
#             for line in file:
#                 log_entries.append(json.loads(line))
#     return log_entries

def load_log_data(file_path):
    log_entries = []
    
    if os.path.isfile(file_path) and file_path.endswith('.gz'):
        print(f"Reading log file: {file_path}")
        # Use encoding='utf-8' and errors='replace' to handle problematic characters
        with gzip.open(file_path, 'rt', encoding='utf-8', errors='replace') as file:
            for line in file:
                try:
                    log_entries.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"Error parsing JSON in file {file_path}: {e}")
                    continue
    
    elif os.path.isfile(file_path) and file_path.endswith('.log'):
        print(f"Reading log file: {file_path}")
        # Also use encoding='utf-8' and errors='replace' for .log files
        with open(file_path, 'r', encoding='utf-8', errors='replace') as file:
            for line in file:
                try:
                    log_entries.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"Error parsing JSON in file {file_path}: {e}")
                    continue
    
    return log_entries

# Hàm đọc tất cả dữ liệu log từ thư mục
def load_all_log_data(folder_path):
    log_entries = []
    for file_name in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file_name)
        log_entries.extend(load_log_data(file_path))
    return log_entries

# Hàm trích xuất nội dung JSON từ chuỗi log
def extract_object(input_string):
    match = re.search(r'\{(.*)\}', input_string)
    if match:
        content = match.group(1)

        # Convert the content into a dictionary
        content_dict = {}
        for item in content.split(', '):
            key, value = item.split(':', 1)
            key = key.strip()
            value = value.strip().strip('"')
            content_dict[key] = value

        return content_dict
    else:
        return None

# Hàm lấy loại thông điệp từ chuỗi log (AddOrderMessage, ModifyOrderMessage, v.v.)
def get_message_type(input_string):
    if GET_LOG_ORDER:
        for order_message_type in ORDER_MESSAGE_TYPES:
            if (order_message_type in input_string):
                return order_message_type
    elif GET_LOG_QUOTE:
        for message_type in MESSAGE_TYPES:
            if (message_type in input_string):
                return message_type
    return None

# Hàm chuyển đổi chuỗi thời gian thành timestamp (2024-03-01T12:30:45Z -> 1709203845)
# def convert_to_timestamp(time_string):
#     dt_object = datetime.strptime(time_string, '%Y-%m-%dT%H:%M:%SZ')
#     return dt_object.timestamp()

def convert_to_timestamp(time_string):
    dt_object = datetime.strptime(time_string, '%Y-%m-%dT%H:%M:%S%z')
    # timestamp() will return timestamp in local timzone if no tz is set explicitly => needs to force to utc tz before transforming to POSIX Timezone
    # dt_object_utc = dt_object.replace(tzinfo=timezone.utc)
    return dt_object.timestamp()

# Hàm phân tích từng dòng log
def parse_log_entry(log):
    message = log['message']
    if 'Unsupported' in message or 'Err: redis: nil' in message or 'message_handler' not in log['caller']:
        return None
    log['timestamp'] = convert_to_timestamp(log['time'])
    message_type = get_message_type(message)
    if message_type is None:
        # print(f"Failed to get message type, {log}")
        return None
    log['message_type'] = message_type
    parsed_message = extract_object(message)
    if parsed_message is None:
        print(f"Failed to parse message object, {log}")
        return None
    log['parsed_message'] = parsed_message
    return log

# Hàm check message có trong timeRange
def is_in_time_range(message, start_timestamp_micros, end_timestamp_micros):
    """Check if a message timestamp is within the specified range"""
    if 'parsed_message' in message:
        message_timestamp = int(message['parsed_message'].get('Timestamp'))
        return start_timestamp_micros <= message_timestamp <= end_timestamp_micros
    return False

# Hàm check message có targetPrice
def has_fixed_price(message, target_price):
    """Check if a message has a fixed price equal to target_price"""
    try:
        price = float(message.get('parsed_message', {}).get('Price'))
        return price == target_price
    except (TypeError, ValueError):
        return False


# Hàm lọc order với targetPrice và timeRange
def filter_orders_by_price_and_time_range(logs, target_price, start_timestamp_micros, end_timestamp_micros):
    filtered_logs = {}
    for symbol_value, orders in logs.items():
        for order_id, log_entries in orders.items():
            has_price = any(has_fixed_price(entry, target_price) for entry in log_entries)
            has_time_in_range = any(is_in_time_range(entry, start_timestamp_micros, end_timestamp_micros)
                                   for entry in log_entries)
            
            if has_price and has_time_in_range:
                if symbol_value not in filtered_logs:
                    filtered_logs[symbol_value] = {}
                filtered_logs[symbol_value][order_id] = log_entries
     
    return filtered_logs


# Hàm lọc messages log theo timeRange
def filter_logs_by_time_range(logs, start_timestamp_micros, end_timestamp_micros):
    """Filter logs to only include entries within the specified timestamp range"""
    # Create a filtered copy of the logs dictionary
    filtered_logs = {}
    
    for symbol_value, orders in logs.items():
        filtered_orders = {}
        for order_id, log_entries in orders.items():
            # Check if any message in this order falls within the time range
            time_filtered_entries = []
            for entry in log_entries:
                # Get the original timestamp from the parsed_message
                entry_timestamp_micros = int(entry['parsed_message'].get('Timestamp'))
                
                if entry_timestamp_micros:
                    try:                                     
                        # Check if the message timestamp is within the range
                        if start_timestamp_micros <= entry_timestamp_micros <= end_timestamp_micros:
                            time_filtered_entries.append(entry)
                    except (ValueError, TypeError):
                        # If we can't parse the timestamp, skip this entry
                        continue
                    
            # Only include orders that have at least one message within the time range
            if time_filtered_entries:
                filtered_orders[order_id] = time_filtered_entries
                
        # Only include symbols that have at least one order after filtering
        if filtered_orders:
            filtered_logs[symbol_value] = filtered_orders
    
    return filtered_logs

# Hàm lọc các log theo symbol
def filter_logs_by_symbol(logs, symbol):
    """Filter logs to only include specified symbols"""
    filtered_logs = {}
    for symbol_value, orders in logs.items():
        if symbol_value == symbol:
            filtered_logs[symbol_value] = orders
    return filtered_logs

# Hàm lọc các log chứa loại type cụ thể
def filter_logs_contain_message_type(logs, message_type):
    filtered_logs = {}
    for symbol, orders in logs.items():
        for order_id, log_entries in orders.items():
            if any(entry['message_type'] == message_type for entry in log_entries):
                if symbol not in filtered_logs:
                    filtered_logs[symbol] = {}
                filtered_logs[symbol][order_id] = log_entries
    return filtered_logs

def extract_all_executed_message_by_symbol(logs):
    filtered_logs = {}
    for symbol, orders in logs.items():
        for _, log_entries in orders.items():
            for order_log in log_entries:
                if (order_log['message_type'] == 'OrderExecutedMessage' and 'Price' in order_log['parsed_message']):
                    if symbol not in filtered_logs:
                        filtered_logs[symbol] = []
                    filtered_logs[symbol].append(order_log)
    for symbol, order_logs in filtered_logs.items():
        sorted_logs = sorted(order_logs, key=lambda x: x['timestamp'])
        filtered_logs[symbol] = sorted_logs

    return filtered_logs

# Hàm nhóm và sắp xếp các log theo symbol và order id
def group_and_sort_logs(parsed_logs):
    if GET_LOG_ORDER:
        # Map OrderID:Symbol
        order_id_symbol_map = {}
        for log in parsed_logs:
            if log['message_type'] == 'AddOrderMessage':
                order_id = log['parsed_message']['OrderID']
                symbol = log['parsed_message']['Symbol']
                order_id_symbol_map[order_id] = symbol

        # Group logs by OrderID
        grouped_logs = defaultdict(lambda: defaultdict(list))
        for log in parsed_logs:
            order_id_raw = log['parsed_message']['OrderID']
             # Chỉ split nếu order_id_raw chứa dấu "
            order_id = order_id_raw.split('"')[0] if '"' in order_id_raw else order_id_raw

            if order_id in order_id_symbol_map:
                symbol = order_id_symbol_map[order_id]
                grouped_logs[symbol][order_id].append(log)

        # Sort each group by timestamp
        for symbol, order_logs in grouped_logs.items():
            for order_id, messages in order_logs.items():
                # Custom sort key: first by timestamp, then by message type priority
                messages.sort(key=lambda x: (
                    x['timestamp'],
                    # Priority order: AddOrderMessage first, DeleteOrderMessage last, others in between
                    0 if x['message_type'] == 'AddOrderMessage' else 
                    2 if x['message_type'] == 'DeleteOrderMessage' else 1
                ))
    elif GET_LOG_QUOTE:
        # Map OrderID:Symbol
        order_id_symbol_map = {}
        for log in parsed_logs:
            if log['message_type'] == 'AuctionUpdateMessage':
                order_id = log['parsed_message']['Symbol']
                symbol = log['parsed_message']['Symbol']
                order_id_symbol_map[order_id] = symbol

        # Group logs by OrderID
        grouped_logs = defaultdict(list)
        for log in parsed_logs:
            order_id = log['parsed_message']['Symbol']
            if order_id in order_id_symbol_map:
                symbol = order_id_symbol_map[order_id]
                grouped_logs[symbol].append(log)

        # Sort each group by timestamp
        for symbol, order_logs in grouped_logs.items():
            order_logs.sort(key=lambda x: x['timestamp'])

    return grouped_logs

# Hàm cập nhật thông điệp OrderExecutedMessage với giá trị Price từ thông điệp ModifyOrderMessage hoặc AddOrderMessage
def update_order_executed_messages(grouped_sorted_logs):
    for symbol, order_logs in grouped_sorted_logs.items():
        for _, messages in order_logs.items():
            last_modify_order_message = None
            add_order_message = None
            last_executed_order_message = None  # Initialize this variable here
            
            for message in messages:
                message['parsed_message']['Symbol'] = symbol
                
                if message['message_type'] == 'AddOrderMessage':
                    add_order_message = message
                
                elif message['message_type'] == 'ModifyOrderMessage':
                    last_modify_order_message = message
                    # Check if add_order_message exists before accessing it
                    if add_order_message and 'parsed_message' in add_order_message:
                        message['parsed_message']['SideIndicator'] = add_order_message['parsed_message']['SideIndicator']
                    else:
                        message['parsed_message']['SideIndicator'] = None  # Default value
                
                elif message['message_type'] == 'OrderExecutedMessage':
                    # Check if add_order_message exists before accessing it
                    if add_order_message and 'parsed_message' in add_order_message:
                        message['parsed_message']['SideIndicator'] = add_order_message['parsed_message']['SideIndicator']
                    else:
                        message['parsed_message']['SideIndicator'] = None  # Default value
                    
                    if last_modify_order_message:
                        message['parsed_message']['Price'] = last_modify_order_message['parsed_message']['Price']
                    elif add_order_message:
                        message['parsed_message']['Price'] = add_order_message['parsed_message']['Price']
                    
                    last_executed_order_message = message
                
                elif message['message_type'] == 'DeleteOrderMessage':
                    # Check if add_order_message exists before accessing it
                    if add_order_message and 'parsed_message' in add_order_message:
                        message['parsed_message']['SideIndicator'] = add_order_message['parsed_message']['SideIndicator']
                    else:
                        message['parsed_message']['SideIndicator'] = None  # Default value
                    
                    if last_modify_order_message:
                        message['parsed_message']['OrderID'] = last_modify_order_message['parsed_message']['OrderID']
                        message['parsed_message']['Price'] = last_modify_order_message['parsed_message']['Price']
                        if last_executed_order_message:
                            message['parsed_message']['Quantity'] = str(int(last_modify_order_message['parsed_message']['Quantity']) - int(last_executed_order_message['parsed_message']['ExecutedQty']))
                        else:
                            message['parsed_message']['Quantity'] = last_modify_order_message['parsed_message']['Quantity']
                    elif add_order_message:
                        message['parsed_message']['OrderID'] = add_order_message['parsed_message']['OrderID']
                        message['parsed_message']['Price'] = add_order_message['parsed_message']['Price']
                        if last_executed_order_message:
                            message['parsed_message']['Quantity'] = str(int(add_order_message['parsed_message']['Quantity']) - int(last_executed_order_message['parsed_message']['ExecutedQty']))
                        else:
                            message['parsed_message']['Quantity'] = add_order_message['parsed_message']['Quantity']

# # Hàm cập nhật thông điệp OrderExecutedMessage với giá trị Price từ thông điệp ModifyOrderMessage hoặc AddOrderMessage
# def update_order_executed_messages(grouped_sorted_logs):
#     for symbol, order_logs in grouped_sorted_logs.items():
#         for _, messages in order_logs.items():
#             last_modify_order_message = None
#             add_order_message = None

#             for message in messages:
#                 message['parsed_message']['Symbol'] = symbol

#                 if message['message_type'] == 'AddOrderMessage':
#                     add_order_message = message
#                 elif message['message_type'] == 'ModifyOrderMessage':
#                     last_modify_order_message = message
#                 elif message['message_type'] == 'OrderExecutedMessage':
#                     if last_modify_order_message:
#                         message['parsed_message']['Price'] = last_modify_order_message['parsed_message']['Price']
#                     elif add_order_message:
#                         message['parsed_message']['Price'] = add_order_message['parsed_message']['Price']
#                 elif message['message_type'] == 'DeleteOrderMessage':
#                     if last_modify_order_message:
#                         message['parsed_message']['OrderID'] = last_modify_order_message['parsed_message']['OrderID']
#                         message['parsed_message']['Price'] = last_modify_order_message['parsed_message']['Price']
#                     elif add_order_message:
#                         message['parsed_message']['OrderID'] = add_order_message['parsed_message']['OrderID']
#                         message['parsed_message']['Price'] = add_order_message['parsed_message']['Price']


def convert_to_au_datetime(dt_obj):
    """Chuyển đổi datetime sang múi giờ Sydney (tự động xử lý DST)"""
    if dt_obj.tzinfo is None:  # Kiểm tra naive datetime
        dt_obj = dt_obj.replace(tzinfo=timezone.utc)  # Gán UTC
    return dt_obj.astimezone(ZoneInfo("Australia/Sydney"))


# def convert_to_au_datetime(dt_obj, source_tz="UTC"):
#     if dt_obj.tzinfo is None:
#         source_tz = ZoneInfo(source_tz)  # Ví dụ: "Asia/Ho_Chi_Minh"
#         dt_obj = dt_obj.replace(tzinfo=source_tz)
#     return dt_obj.astimezone(ZoneInfo("Australia/Sydney"))

def round_datetime(timestamp: datetime, timeframe: str) -> datetime:
    """Làm tròn thời gian theo khung thời gian"""
    if timeframe == '1m':
        return timestamp.replace(second=0, microsecond=0)
    elif timeframe == '1h':
        return timestamp.replace(minute=0, second=0, microsecond=0)
    elif timeframe == '1d':
        return timestamp.replace(hour=0, minute=0, second=0, microsecond=0)
    raise ValueError(f"Timeframe không hợp lệ: {timeframe}")

def construct_candlestick_data(logs, timeframes=['1m', '1h', '1d']):
    # Define the time delta based on the timeframe
    time_deltas = {
        '1m': timedelta(minutes=1),
        '1h': timedelta(hours=1),
        '1d': timedelta(days=1)
    }

    # Initialize the result dictionary
    candlestick_data = {}

    # Iterate over each log entry
    for symbol, order_logs in logs.items():
        #sort all executed msgs according to symbol
        order_logs.sort(key=lambda x:x['timestamp'])

        # Initialize the symbol entry if not present
        if symbol not in candlestick_data:
            candlestick_data[symbol] = {tf: [] for tf in timeframes}

        for log in order_logs:
            # Bỏ qua nếu không có giá            
            if ('Price' not in log['parsed_message']):
                continue

            try:
                # Xử lý timestamp và giá
                timestamp = datetime.fromtimestamp(log['timestamp'], timezone.utc)
                price = float(log['parsed_message']['Price'])

                for timeframe in timeframes:
                    # Tính toán thời gian bắt đầu/kết thúc
                    start_time = round_datetime(
                        convert_to_au_datetime(timestamp),
                        timeframe
                    )
                    end_time = start_time + time_deltas[timeframe]

                    # Lấy nến cuối cùng nếu có
                    candles = candlestick_data[symbol][timeframe]
                    last_candle = candles[-1] if candles else None

                    # Kiểm tra có cần tạo nến mới không
                    if not candles or timestamp >= last_candle['end_time']:
                        candles.append({
                            **{'symbol': symbol}, # thêm symbol cho dễ nhìn
                            'start_time': start_time,
                            'end_time': end_time,
                            'open': price,
                            'high': price,
                            'low': price,
                            'close': price
                        })
                    else:
                        # Cập nhật nến hiện tại
                        last_candle['high'] = max(last_candle['high'], price)
                        last_candle['low'] = min(last_candle['low'], price)
                        last_candle['close'] = price

            except (KeyError, ValueError, TypeError) as e:
                print(f"Lỗi khi xử lý log: {log}. Chi tiết: {str(e)}")
                continue

    # Convert datetime objects to strings for JSON serialization
    for symbol_data in candlestick_data.values():
        for timeframe_data in symbol_data.values():
            for candle in timeframe_data:
                for time_key in ['start_time', 'end_time']:
                    if isinstance(candle[time_key], datetime):
                        candle[time_key] = candle[time_key].strftime('%Y-%m-%dT%H:%M:%SZ')

    return candlestick_data

def check_date(date_input):
    # Ngày bạn muốn kiểm tra
    check_date = "20250214"

    # Chuyển đổi chuỗi thành đối tượng datetime
    dt = datetime.strptime(date_input, "%Y-%m-%dT%H:%M:%SZ")

    # Lấy phần ngày dưới dạng chuỗi "YYYYMMDD"
    date_str = dt.strftime("%Y%m%d")

    # Kiểm tra nếu ngày trùng với ngày cần kiểm tra
    if date_str == check_date:
        return True
    else:
        return False
    
# Hàm chính xuất kết quả vào file JSON
def main():
    log_data = load_all_log_data('abc')
    print('Successfully loaded all log data')

    print('Parsing log data...')
    parsed_log = list(filter(None, map(parse_log_entry, log_data)))

    print('Grouping logs by symbol and order id...')
    grouped_sorted_order_logs = group_and_sort_logs(parsed_log)

    if GET_LOG_ORDER:
        update_order_executed_messages(grouped_sorted_order_logs)


    if FILTER_ONLY_EXECUTED:
        logs_to_export = filter_logs_contain_message_type(grouped_sorted_order_logs, 'OrderExecutedMessage')
    else:
        logs_to_export = grouped_sorted_order_logs

    if USE_SYMBOL_FILTER:
        logs_to_export = filter_logs_by_symbol(logs_to_export, symbol[0])
    
    if USE_TIME_FILTER:
        print(f"Filtering logs by timestamp range: {START_TIME} to {END_TIME}")
        logs_to_export = filter_logs_by_time_range(logs_to_export, START_TIME, END_TIME)
    
    if USE_TIME_AND_PRICE_FILTER:
        target_price = 34.36
        print(f"Filtering logs by target price: {target_price} and timestamp range: {START_TIME} to {END_TIME}")
        logs_to_export = filter_orders_by_price_and_time_range(logs_to_export, target_price, START_TIME, END_TIME)

    # Get the current datetime string
    datetime_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    all_executed_message_by_symbol = extract_all_executed_message_by_symbol(logs_to_export)

    with open(f'all_executed_message_by_symbol_{datetime_str}.json', 'w') as f:
        json.dump(all_executed_message_by_symbol, f, indent=4)

    candlestick_data = construct_candlestick_data(all_executed_message_by_symbol)
    
    with open(f'candlestick_data_{datetime_str}.json', 'w') as f:
        json.dump(candlestick_data, f, indent=4)
    
    print("Exporting to json file...")
    # Write the result to a JSON file
    with open(f'grouped_by_symbol_{symbol[0]}_{datetime_str}.json', 'w') as f:
        json.dump(logs_to_export, f, indent=4)

    print("Export complete")

if __name__ == '__main__':
    main()