import json
import sys

def read_json_data(file_path, encoding='utf-8'):
    """Read JSON data from file with comprehensive error handling"""
    try:
        with open(file_path, 'r', encoding=encoding) as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{file_path}' does not exist.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: File '{file_path}' contains invalid JSON.")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error reading file: {e}")
        sys.exit(1)

def save_to_json(data, output_file_path, encoding='utf-8'):
    """Save data to JSON file with error handling"""
    try:
        with open(output_file_path, 'w', encoding=encoding) as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Data successfully saved to {output_file_path}")
        return True
    except Exception as e:
        print(f"Error saving file: {e}")
        return False

def get_symbol_data(data, symbol):
    """Safely retrieve data for a specific symbol"""
    return {
        symbol : data.get(symbol, []) # Returns None if symbol doesn't exist
    }

def main():
    # Configuration
    input_file = 'test/sort_desc.json'
    output_file = 'test/output.json'
    target_symbol = 'AAA'  # Can be changed to any symbol
    
    # Process data
    json_data = read_json_data(input_file)
    symbol_data = get_symbol_data(json_data, target_symbol)
    
    if symbol_data:
        print(f"Data for symbol '{target_symbol}':")
        # print(json.dumps(symbol_data, indent=4, ensure_ascii=False))
        save_to_json(symbol_data, output_file)
    else:
        print(f"No data found for symbol '{target_symbol}' in the file.")

if __name__ == "__main__":
    main()