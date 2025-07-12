from fpdf import FPDF
import random
import string

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

# Tạo một chuỗi văn bản dài
for _ in range(180000):  # Số dòng có thể điều chỉnh để đủ 15MB
    text = ''.join(random.choices(string.ascii_letters + string.digits, k=100))
    pdf.cell(200, 10, txt=text, ln=True)

pdf.output("output_15MB.pdf")
