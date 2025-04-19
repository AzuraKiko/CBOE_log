import os
import json
import re
import gzip
from datetime import datetime
from collections import defaultdict

FILTER_ONLY_EXECUTED = False
# ORDER_MESSAGE_TYPES = ['CalculatedValueMessage','AddOrderMessage', 'OrderExecutedMessage', 'ModifyOrderMessage', 'DeleteOrderMessage']
ORDER_MESSAGE_TYPES = ['CalculatedValueMessage']

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
    dt_object = datetime.strptime(time_string, '%Y-%m-%dT%H:%M:%SZ')
    return dt_object.timestamp()
    
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

def group_and_sort_logs(parsed_logs):
    # Map OrderID:Symbol
    order_id_symbol_map = {}
    for log in parsed_logs:
        if log['message_type'] == 'CalculatedValueMessage':
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
        # for order_id, messages in order_logs.items():
            order_logs.sort(key=lambda x: x['timestamp'])
    
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

def main():
    log_data = load_all_log_data('logs')
    print('Successfully loaded all log data')
    
    print('Parsing log data...')
    parsed_log = list(filter(None, map(parse_log_entry, log_data)))

    print('Grouping logs by symbol and order id...')
    grouped_sorted_order_logs = group_and_sort_logs(parsed_log)
    # update_order_executed_messages(grouped_sorted_order_logs)

    
    if FILTER_ONLY_EXECUTED:
        logs_to_export = filter_logs_contain_message_type(grouped_sorted_order_logs, 'OrderExecutedMessage')
    else:
        logs_to_export = grouped_sorted_order_logs
    # Get the current datetime string
    datetime_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    print("Exporting to json file...")
    # Write the result to a JSON file
    with open(f'grouped_by_symbol_{datetime_str}.json', 'w') as f:
        json.dump(logs_to_export, f, indent=4)

if __name__ == '__main__':
    main()