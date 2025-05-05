import xlwt

workbook = xlwt.Workbook()
sheet = workbook.add_sheet('Users')

headers = ["Full Name", "Email", "Phone", "Role", "Department"]
for col, header in enumerate(headers):
    sheet.write(0, col, header)

rows = [
    ["Nguyen Van A", "vana@example.com", "0901234567", "User", "Sales"],
    ["Tran Thi B", "thib@example.com", "0912345678", "Admin", "HR"],
    ["Le Van C", "vanc@example.com", "0923456789", "User", "IT"]
]

for row_idx, row in enumerate(rows, start=1):
    for col_idx, cell in enumerate(row):
        sheet.write(row_idx, col_idx, cell)

workbook.save('user_list.xls')
