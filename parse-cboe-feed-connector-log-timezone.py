import os
import re
import gzip
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from zoneinfo import ZoneInfo
import json

FILTER_ONLY_EXECUTED = True
ORDER_MESSAGE_TYPES = ['AddOrderMessage', 'OrderExecutedMessage', 'ModifyOrderMessage', 'DeleteOrderMessage']

def load_log_data(file_path):
    log_entries = []
    if os.path.isfile(file_path) and file_path.endswith('.gz'):
        print(f"Reading log file: {file_path}")
        with gzip.open(file_path, 'rt') as file:
            for line in file:
                log_entries.append(json.loads(line))
    elif os.path.isfile(file_path) and file_path.endswith('.log'):
        print(f"Reading log file: {file_path}")
        with open(file_path, 'r') as file:
            for line in file:
                log_entries.append(json.loads(line))
    return log_entries

def load_all_log_data(folder_path):
    log_entries = []
    for file_name in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file_name)
        log_entries.extend(load_log_data(file_path))
    return log_entries

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
    
def get_message_type(input_string):
    for order_message_type in ORDER_MESSAGE_TYPES:
        if (order_message_type in input_string):
            return order_message_type
    
    return None

def convert_to_timestamp(time_string):
    dt_object = datetime.strptime(time_string, '%Y-%m-%dT%H:%M:%S%z')
    # timestamp() will return timestamp in local timzone if no tz is set explicitly => needs to force to utc tz before transforming to POSIX Timezone
    # dt_object_utc = dt_object.replace(tzinfo=timezone.utc)
    return dt_object.timestamp()
    
def parse_log_entry(log):
    message = log['message']

    if 'Unsupported' in message or 'Err: redis: nil' in message or 'message_handler' not in log.get('caller', ''):
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

def group_and_sort_logs(parsed_logs):
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
        order_id = log['parsed_message']['OrderID']
        if order_id in order_id_symbol_map:
            symbol = order_id_symbol_map[order_id]
            grouped_logs[symbol][order_id].append(log)
    
    # Sort each group by timestamp
    for symbol, order_logs in grouped_logs.items():
        for order_id, messages in order_logs.items():
            messages.sort(key=lambda x: x['timestamp'])
    
    return grouped_logs

def update_order_executed_messages(grouped_sorted_logs):
    for symbol, order_logs in grouped_sorted_logs.items():
        for _, messages in order_logs.items():
            last_modify_order_message = None
            add_order_message = None
            
            for message in messages:
                message['parsed_message']['Symbol'] = symbol

                if message['message_type'] == 'AddOrderMessage':
                    add_order_message = message
                elif message['message_type'] == 'ModifyOrderMessage':
                    last_modify_order_message = message
                elif message['message_type'] == 'OrderExecutedMessage':
                    if last_modify_order_message:
                        message['parsed_message']['Price'] = last_modify_order_message['parsed_message']['Price']
                    elif add_order_message:
                        message['parsed_message']['Price'] = add_order_message['parsed_message']['Price']
                

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
    for symbol, logs in filtered_logs.items():
        sorted_logs = sorted(logs, key=lambda x: x['timestamp'])
        filtered_logs[symbol] = sorted_logs
        #     filtered_logs[symbol][order_id] = order_logs.sort(lambda x: x['timestamp'])

    return filtered_logs

def convert_to_au_datetime(utc_datetime_obj):
    return utc_datetime_obj.astimezone(ZoneInfo("Australia/Sydney"))


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
        for log in order_logs:
            timestamp = datetime.fromtimestamp(log['timestamp'], timezone.utc)

            if ('Price' not in log['parsed_message']):
                continue

            price = float(log['parsed_message']['Price'])

            # Initialize the symbol entry if not present
            if symbol not in candlestick_data:
                candlestick_data[symbol] = {tf: [] for tf in timeframes}

            for timeframe in timeframes:
                time_delta = time_deltas[timeframe]

                # Calculate the start and end times with 00 seconds
                if timeframe == '1m':
                    start_time = convert_to_au_datetime(timestamp).replace(second=0, microsecond=0, tzinfo=ZoneInfo("Australia/Sydney"))
                elif timeframe == '1h':
                    start_time = convert_to_au_datetime(timestamp).replace(minute=0, second=0, microsecond=0, tzinfo=ZoneInfo("Australia/Sydney"))
                elif timeframe == '1d':
                    start_time = convert_to_au_datetime(timestamp).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=ZoneInfo("Australia/Sydney"))

                end_time = start_time + time_delta

                # Find the appropriate candlestick entry or create a new one
                if not candlestick_data[symbol][timeframe] or timestamp >= candlestick_data[symbol][timeframe][-1]['end_time']:
                    # Create a new candlestick entry
                    candlestick_entry = {
                        **{'symbol': symbol}, # thêm symbol cho dễ nhìn
                        'start_time': start_time,
                        'end_time': end_time,
                        'open': price,
                        'high': price,
                        'low': price,
                        'close': price
                    }
                    candlestick_data[symbol][timeframe].append(candlestick_entry)
                else:
                    # Update the existing candlestick entry
                    candlestick_entry = candlestick_data[symbol][timeframe][-1]
                    candlestick_entry['high'] = max(candlestick_entry['high'], price)
                    candlestick_entry['low'] = min(candlestick_entry['low'], price)
                    candlestick_entry['close'] = price

    # Convert datetime objects to strings for JSON serialization
    for symbol in candlestick_data:
        for timeframe in candlestick_data[symbol]:
            for entry in candlestick_data[symbol][timeframe]:
                entry['start_time'] = entry['start_time'].strftime('%Y-%m-%dT%H:%M:%SZ')
                entry['end_time'] = entry['end_time'].strftime('%Y-%m-%dT%H:%M:%SZ')

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

def main():
    log_data = load_all_log_data('1004')
    print('Successfully loaded all log data')
    
    print('Parsing log data...')
    parsed_log = list(filter(None, map(parse_log_entry, log_data)))

    print('Grouping logs by symbol and order id...')
    grouped_sorted_order_logs = group_and_sort_logs(parsed_log)
    update_order_executed_messages(grouped_sorted_order_logs)

    only_order_log_with_executed_message = filter_logs_contain_message_type(grouped_sorted_order_logs, 'OrderExecutedMessage')

    # Get the current datetime string
    datetime_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    all_executed_message_by_symbol = extract_all_executed_message_by_symbol(only_order_log_with_executed_message)

    with open(f'all_executed_message_by_symbol_{datetime_str}.json', 'w') as f:
        json.dump(all_executed_message_by_symbol, f, indent=4)

    # candlestick_data = construct_candlestick_data(all_executed_message_by_symbol)
    candlestick_data = construct_candlestick_data(all_executed_message_by_symbol) #test
    
    with open(f'candlestick_data_{datetime_str}.json', 'w') as f:
        json.dump(candlestick_data, f, indent=4)

    if FILTER_ONLY_EXECUTED:
        logs_to_export = only_order_log_with_executed_message
    else:
        logs_to_export = grouped_sorted_order_logs

    print("Exporting to json file...")
    # Write the result to a JSON file
    with open(f'grouped_by_symbol_and_order_id_{datetime_str}.json', 'w') as f:
        json.dump(logs_to_export, f, indent=4)

    print("Export complete")

    
if __name__ == '__main__':
    main()