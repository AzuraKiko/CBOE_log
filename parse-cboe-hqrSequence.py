import os
import json
import re
import gzip
from datetime import datetime, timezone
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
USE_TIME_FILTER = True  # Set to False to disable time filtering
START_TIME = 1747106717235000
END_TIME = 1747106717239000


def load_log_data(file_path):
    """Load log entries from a single file with proper error handling."""
    log_entries = []

    if not os.path.isfile(file_path):
        logger.warning(f"File does not exist: {file_path}")
        return log_entries

    try:
        logger.info(f"Reading log file: {file_path}")

        # Handle gzip compressed files
        if file_path.endswith(".gz"):
            open_func = lambda: gzip.open(
                file_path, "rt", encoding="utf-8", errors="replace"
            )
        # Handle plain text log files
        elif file_path.endswith(".log"):
            open_func = lambda: open(file_path, "r", encoding="utf-8", errors="replace")
        else:
            logger.warning(f"Unsupported file format: {file_path}")
            return log_entries

        with open_func() as file:
            for line_num, line in enumerate(file, 1):
                try:
                    log_entries.append(json.loads(line))
                except json.JSONDecodeError as e:
                    logger.error(
                        f"Error parsing JSON in {file_path}, line {line_num}: {e}"
                    )
                except Exception as e:
                    logger.error(
                        f"Unexpected error reading {file_path}, line {line_num}: {e}"
                    )
    except Exception as e:
        logger.error(f"Failed to process file {file_path}: {e}")

    return log_entries


def load_all_log_data(folder_path):
    """Load log data from all valid files in the specified folder."""
    if not os.path.exists(folder_path):
        logger.error(f"Folder does not exist: {folder_path}")
        return []

    log_entries = []
    for file_name in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file_name)
        if os.path.isfile(file_path) and (
            file_path.endswith(".gz") or file_path.endswith(".log")
        ):
            entries = load_log_data(file_path)
            logger.info(f"Loaded {len(entries)} entries from {file_name}")
            log_entries.extend(entries)

    logger.info(f"Total log entries loaded: {len(log_entries)}")
    return log_entries


def extract_object(input_string):
    """Extract JSON content from log message string."""
    try:
        match = re.search(r"\{(.*)\}", input_string)
        if not match:
            return None

        content = match.group(1)

        # More robust parsing of key-value pairs
        content_dict = {}
        # Split by commas, but not those inside quotes
        items = re.findall(r"([^,]+:[^,]+)(?:,|$)", content)

        for item in items:
            if ":" not in item:
                continue

            key, value = item.split(":", 1)
            key = key.strip()
            value = value.strip().strip('"')
            content_dict[key] = value

        return content_dict
    except Exception as e:
        logger.error(f"Error parsing object: {e}, input: {input_string[:100]}...")
        return None


def convert_to_timestamp(time_string):
    """Convert ISO format time string to UNIX timestamp."""
    try:
        # Handle ISO format with timezone
        dt_object = datetime.strptime(time_string, "%Y-%m-%dT%H:%M:%S%z")
        return dt_object.timestamp()
    except ValueError:
        try:
            # Handle ISO format without timezone (assume UTC)
            dt_object = datetime.strptime(time_string, "%Y-%m-%dT%H:%M:%SZ")
            dt_object = dt_object.replace(tzinfo=timezone.utc)
            return dt_object.timestamp()
        except ValueError as e:
            logger.error(f"Failed to parse timestamp: {time_string}, error: {e}")
            return 0


def parse_log_entry(log):
    """Parse a single log entry."""
    try:
        if not isinstance(log, dict):
            return None

        message = log.get("message", "")
        caller = log.get("caller", "")

        # Filter out irrelevant logs early
        if (
            "Unsupported" in message
            or "Err: redis: nil" in message
            or "message_handler" not in caller
            or "HdrSequence" not in message
        ):
            return None

        # Parse timestamp
        if "time" in log:
            log["timestamp"] = convert_to_timestamp(log["time"])

        # Extract message content
        parsed_message = extract_object(message)
        if parsed_message is None:
            return None

        log["parsed_message"] = parsed_message
        return log
    except Exception as e:
        logger.error(f"Error parsing log entry: {e}")
        return None


def group_and_sort_logs(parsed_logs):
    """Group and sort logs by sequence number."""
    try:
        return sorted(
            parsed_logs, key=lambda x: int(x["parsed_message"].get("HdrSequence", 0))
        )
    except Exception as e:
        logger.error(f"Error sorting logs: {e}")
        # Return unsorted if sorting fails
        return parsed_logs


def is_in_time_range(message, start_timestamp_micros, end_timestamp_micros):
    """Check if a message timestamp is within the specified range."""
    try:
        if "parsed_message" in message:
            message_timestamp = int(message["parsed_message"].get("Timestamp", 0))
            return start_timestamp_micros <= message_timestamp <= end_timestamp_micros
    except (ValueError, TypeError) as e:
        logger.error(f"Error checking time range: {e}")
    return False


def filter_logs_by_time_range(logs, start_timestamp_micros, end_timestamp_micros):
    """Filter logs by time range."""
    filtered_logs = [
        log
        for log in logs
        if is_in_time_range(log, start_timestamp_micros, end_timestamp_micros)
    ]

    logger.info(
        f"Filtered {len(logs)} logs to {len(filtered_logs)} logs within time range"
    )
    return filtered_logs


def validate_sequence_increments(sorted_logs):
    """
    Check if HdrSequence values are incrementing by exactly 1.

    Args:
        sorted_logs: List of log entries sorted by HdrSequence

    Returns:
        dict: Contains validation results with these fields:
            - valid: Boolean indicating if all sequences are valid
            - total_logs: Total number of logs checked
            - errors: List of errors found (missing or incorrect sequences)
    """
    result = {"valid": True, "total_logs": len(sorted_logs), "errors": []}

    if not sorted_logs:
        logger.warning("No logs to validate sequence")
        return result

    try:
        prev_seq = None
        for idx, log in enumerate(sorted_logs):
            current_seq = int(log["parsed_message"].get("HdrSequence", 0))

            # Skip the first entry as we need a previous value to compare
            if prev_seq is not None:
                expected_seq = prev_seq + 1

                # Check if the sequence increments exactly by 1
                if current_seq != expected_seq:
                    result["valid"] = False
                    error = {
                        "index": idx,
                        "previous_sequence": prev_seq,
                        "current_sequence": current_seq,
                        "expected_sequence": expected_seq,
                        "gap": current_seq - prev_seq,
                    }
                    result["errors"].append(error)
                    logger.warning(
                        f"Sequence error at index {idx}: Expected {expected_seq}, got {current_seq} (gap: {current_seq - prev_seq})"
                    )

            prev_seq = current_seq

        logger.info(
            f"Sequence validation complete: {'VALID' if result['valid'] else 'INVALID with ' + str(len(result['errors'])) + ' errors'}"
        )
        return result

    except Exception as e:
        logger.error(f"Error validating sequence increments: {e}")
        result["valid"] = False
        result["errors"].append({"error": str(e)})
        return result


def main():
    try:
        logger.info("Starting log processing...")

        log_data = load_all_log_data("today")
        if not log_data:
            logger.error("No log data loaded. Exiting.")
            return

        logger.info("Parsing log data...")
        parsed_logs = list(filter(None, map(parse_log_entry, log_data)))
        logger.info(f"Successfully parsed {len(parsed_logs)} log entries")

        logger.info("Sorting logs...")
        logs_to_export = group_and_sort_logs(parsed_logs)

        # Apply time filter if enabled
        if USE_TIME_FILTER:
            logger.info(
                f"Filtering logs by timestamp range: {START_TIME} to {END_TIME}"
            )
            logs_to_export = filter_logs_by_time_range(
                logs_to_export, START_TIME, END_TIME
            )

        # Validate sequence increments
        logger.info("Validating sequence increments...")
        sequence_validation = validate_sequence_increments(logs_to_export)

        # Get the current datetime string for the output filename
        datetime_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        # Export sequence validation results
        validation_filename = f"sequence_validation_{datetime_str}.json"
        with open(validation_filename, "w", encoding="utf-8") as f:
            json.dump(sequence_validation, f, indent=4)
        logger.info(f"Sequence validation results exported to {validation_filename}")

        # Export logs
        output_filename = f"grouped_by_symbol_{datetime_str}.json"
        logger.info(f"Exporting {len(logs_to_export)} logs to {output_filename}...")

        # Write the result to a JSON file
        with open(output_filename, "w", encoding="utf-8") as f:
            json.dump(logs_to_export, f, indent=4)

        logger.info(f"Export complete: {output_filename}")

        # Print validation summary
        if not sequence_validation["valid"]:
            logger.warning(
                f"Found {len(sequence_validation['errors'])} sequence errors out of {sequence_validation['total_logs']} logs"
            )
            if len(sequence_validation["errors"]) <= 10:
                for error in sequence_validation["errors"]:
                    logger.warning(
                        f"Sequence error: Expected {error.get('expected_sequence')}, got {error.get('current_sequence')} (gap: {error.get('gap')})"
                    )
            else:
                logger.warning(
                    f"First 10 sequence errors (from {len(sequence_validation['errors'])} total):"
                )
                for error in sequence_validation["errors"][:10]:
                    logger.warning(
                        f"Sequence error: Expected {error.get('expected_sequence')}, got {error.get('current_sequence')} (gap: {error.get('gap')})"
                    )
        else:
            logger.info("All sequences are valid and increment by exactly 1 unit")

    except Exception as e:
        logger.error(f"An error occurred in the main process: {e}")


if __name__ == "__main__":
    main()
