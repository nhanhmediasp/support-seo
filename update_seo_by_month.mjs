import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "E:/SEO/air seagolbal/outputs/seo-plan/SEO-TONG-THE-PLAN.xlsx";
const outputDir = "E:/SEO/air seagolbal/outputs/seo-plan";
const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const colors = { navy: "#1F4E78", blue: "#D9EAF7", lightBlue: "#EAF3F8", green: "#E2F0D9", yellow: "#FFF2CC", red: "#FCE4D6", border: "#D9E2F3", white: "#FFFFFF", text: "#1F1F1F" };

const monthlyPlans = {
  "Tháng 1": {
    focus: "Nền tảng và nghiên cứu",
    goal: "Hoàn thiện baseline, audit và nền tảng đo lường",
    tasks: [
      ["Khởi động", "Chốt mục tiêu kinh doanh, KPI và phạm vi SEO", "Project brief + KPI", "P0"],
      ["Khởi động", "Thu thập quyền truy cập GA4, GSC, CMS và máy chủ", "Access checklist", "P0"],
      ["Audit", "Audit crawl, index, robots.txt và sitemap.xml", "Technical audit report", "P0"],
      ["Audit", "Kiểm tra canonical, redirect, 404 và duplicate content", "Issue list", "P0"],
      ["Audit", "Đánh giá tốc độ và Core Web Vitals", "Performance report", "P1"],
      ["Đối thủ", "Phân tích 5–10 đối thủ SEO chính", "Competitor report", "P1"],
      ["Keyword", "Nghiên cứu và phân nhóm bộ từ khóa", "Keyword universe", "P0"],
      ["Keyword", "Mapping từ khóa vào URL hiện có và URL mới", "Keyword map", "P0"],
      ["Structure", "Xây dựng sitemap và topic cluster", "SEO architecture", "P1"],
      ["Tracking", "Thiết lập conversion tracking cho lead/đơn hàng", "Tracking verified", "P0"],
    ],
  },
  "Tháng 2": {
    focus: "Technical và On-page ưu tiên cao",
    goal: "Xử lý lỗi nền tảng và tối ưu nhóm trang có giá trị cao",
    tasks: [
      ["Technical", "Sửa lỗi index/crawl nghiêm trọng", "Critical issues resolved", "P0"],
      ["Technical", "Tối ưu robots.txt, sitemap và canonical", "Technical setup", "P0"],
      ["Technical", "Sửa lỗi 404, redirect chain và internal link hỏng", "Clean crawl report", "P1"],
      ["Technical", "Tối ưu mobile usability và tốc độ tải trang", "CWV improvement", "P1"],
      ["On-page", "Tối ưu title và meta description cho trang tiền", "Optimized metadata", "P0"],
      ["On-page", "Tối ưu H1/H2/H3 và nội dung trang dịch vụ", "Service pages optimized", "P0"],
      ["On-page", "Tối ưu CTA và đường dẫn chuyển đổi", "Conversion paths", "P1"],
      ["On-page", "Triển khai internal link theo topic cluster", "Internal link map", "P1"],
      ["Schema", "Thêm schema phù hợp cho từng loại trang", "Valid structured data", "P2"],
      ["Review", "Kiểm tra lại các thay đổi sau khi deploy", "Post-release checklist", "P0"],
    ],
  },
  "Tháng 3": {
    focus: "Content pillar và cluster",
    goal: "Tăng độ phủ chủ đề và bắt đầu tạo traffic ổn định",
    tasks: [
      ["Content", "Xuất bản bài pillar page cho chủ đề chính", "Pillar page published", "P0"],
      ["Content", "Xuất bản 6–10 bài cluster hỗ trợ", "Cluster articles", "P1"],
      ["Content", "Tạo/ tối ưu landing page sản phẩm, dịch vụ", "Money pages", "P0"],
      ["Content", "Tối ưu nội dung cũ có ranking trang 2", "Refresh backlog", "P1"],
      ["On-page", "Bổ sung FAQ, bảng so sánh và thông tin chuyên môn", "SERP enhancements", "P1"],
      ["On-page", "Rà soát cannibalization giữa các URL", "Cannibalization fixes", "P1"],
      ["Internal link", "Liên kết pillar, cluster và trang chuyển đổi", "Topic cluster links", "P1"],
      ["Tracking", "Theo dõi index và hiệu quả từng nhóm nội dung", "Content performance report", "P1"],
      ["Reporting", "Báo cáo KPI quý đầu tiên và backlog tháng 4", "Monthly report", "P1"],
    ],
  },
  "Tháng 4": {
    focus: "Authority, Entity và Local SEO",
    goal: "Tăng độ tin cậy website và độ phủ thương hiệu",
    tasks: [
      ["Off-page", "Audit backlink và referring domains hiện tại", "Backlink audit", "P1"],
      ["Off-page", "Xây dựng danh sách website liên quan để tiếp cận", "Prospect list", "P1"],
      ["Off-page", "Triển khai guest post/digital PR chọn lọc", "Quality placements", "P2"],
      ["Entity", "Tối ưu hồ sơ doanh nghiệp và thông tin thương hiệu", "Brand entity setup", "P1"],
      ["Local", "Tối ưu Google Business Profile nếu có địa điểm", "Local profile", "P2"],
      ["Local", "Chuẩn hóa NAP, citation và đánh giá khách hàng", "Local citations/reviews", "P2"],
      ["Content", "Xuất bản case study và nội dung chuyên gia", "Trust content", "P1"],
      ["Digital PR", "Tạo nội dung có khả năng được trích dẫn", "Linkable asset", "P2"],
      ["Reporting", "Theo dõi backlink mới, brand mention và ranking", "Authority report", "P1"],
    ],
  },
  "Tháng 5": {
    focus: "Mở rộng từ khóa và tối ưu chuyển đổi",
    goal: "Mở rộng vùng phủ và cải thiện hiệu quả kinh doanh từ SEO",
    tasks: [
      ["Keyword", "Mở rộng từ khóa dài và nhóm truy vấn mới", "Expanded keyword map", "P1"],
      ["Content", "Sản xuất nội dung theo content gap của đối thủ", "Gap content", "P1"],
      ["Content", "Cập nhật các bài có traffic/ranking giảm", "Updated content", "P0"],
      ["SERP", "Tối ưu CTR cho trang có impression cao", "CTR improvement list", "P1"],
      ["On-page", "Thử nghiệm title/meta mới cho nhóm ưu tiên", "Metadata tests", "P2"],
      ["CRO", "Tối ưu form, CTA và trang đích có traffic cao", "CRO actions", "P1"],
      ["Technical", "Audit lại tốc độ, mobile và schema", "Technical re-audit", "P1"],
      ["Internal link", "Bổ sung link cho các trang có tiềm năng ranking", "Link opportunities", "P1"],
      ["Reporting", "Đánh giá organic leads và doanh thu theo landing page", "SEO revenue report", "P0"],
    ],
  },
  "Tháng 6": {
    focus: "Tổng kết, củng cố và lập chu kỳ mới",
    goal: "Đánh giá kết quả 6 tháng và xây dựng kế hoạch SEO tiếp theo",
    tasks: [
      ["Audit", "Audit tổng thể lần 2 và so sánh với baseline", "Six-month audit", "P0"],
      ["Keyword", "Rà soát nhóm từ khóa đạt/chưa đạt mục tiêu", "Ranking review", "P1"],
      ["Content", "Xác định nội dung cần giữ, gộp, redirect hoặc xóa", "Content pruning plan", "P1"],
      ["Content", "Lập backlog nội dung cho 6 tháng tiếp theo", "Next content roadmap", "P1"],
      ["Off-page", "Đánh giá chất lượng backlink và cơ hội tiếp theo", "Authority review", "P2"],
      ["CRO", "Tổng hợp landing page, lead và doanh thu hiệu quả nhất", "Conversion analysis", "P0"],
      ["Technical", "Kiểm tra các lỗi phát sinh và thay đổi thuật toán", "Technical health check", "P1"],
      ["Reporting", "Lập báo cáo tổng kết SEO 6 tháng", "Executive SEO report", "P0"],
      ["Planning", "Chốt mục tiêu, ngân sách và nguồn lực chu kỳ mới", "Next-cycle plan", "P0"],
    ],
  },
};

function styleTitle(s, text, subtitle) {
  s.getRange("A1").values = [[text]];
  s.getRange("A1:J1").format = { font: { name: "Arial", size: 16, bold: true, color: colors.navy } };
  s.getRange("A2").values = [[subtitle]];
  s.getRange("A2:J2").format = { font: { name: "Arial", size: 10, italic: true, color: "#666666" } };
}

for (const [month, plan] of Object.entries(monthlyPlans)) {
  let s;
  try { s = workbook.worksheets.getItem(month); } catch { s = workbook.worksheets.add(month); }
  s.showGridLines = false;
  s.tabColor = colors.blue;
  styleTitle(s, `${month.toUpperCase()} — ${plan.focus}`, plan.goal);
  s.getRange("A4:D4").values = [["Tổng số việc", plan.tasks.length, "Đã hoàn thành", 0]];
  s.getRange("F4:I4").values = [["Tỷ lệ hoàn thành", 0, "KPI tháng", ""]];
  s.getRange("A4:J4").format = { fill: colors.lightBlue, font: { name: "Arial", size: 10, bold: true, color: colors.navy }, borders: { preset: "all", style: "thin", color: colors.border } };
  s.getRange("D4").formulas = [[`=COUNTIF(G7:G${6 + plan.tasks.length},"Đã hoàn thành")`]];
  s.getRange("G4").formulas = [[`=IFERROR(D4/B4,0)`]];
  s.getRange("G4").setNumberFormat("0.0%");
  s.getRange("A6:J6").values = [["STT", "Nhóm việc", "Đầu việc cần làm", "Deliverable", "Người phụ trách", "Ưu tiên", "Trạng thái", "Bắt đầu", "Deadline", "Ghi chú"]];
  s.getRange("A6:J6").format = { fill: colors.navy, font: { name: "Arial", size: 10, bold: true, color: colors.white }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "all", style: "thin", color: colors.white } };
  s.getRange(`A7:J${6 + plan.tasks.length}`).values = plan.tasks.map((row, i) => [i + 1, row[0], row[1], row[2], "", row[3], "Chưa làm", "", "", ""]);
  s.getRange(`A7:J${6 + plan.tasks.length}`).format = { font: { name: "Arial", size: 10, color: colors.text }, verticalAlignment: "center", wrapText: true, borders: { preset: "inside", style: "thin", color: colors.border } };
  s.getRange(`A7:A${6 + plan.tasks.length}`).format.horizontalAlignment = "center";
  s.getRange(`F7:F${6 + plan.tasks.length}`).dataValidation = { rule: { type: "list", values: ["P0", "P1", "P2", "P3"] } };
  s.getRange(`G7:G${6 + plan.tasks.length}`).dataValidation = { rule: { type: "list", values: ["Chưa làm", "Đang làm", "Chờ duyệt", "Đã hoàn thành", "Cần tối ưu lại"] } };
  s.getRange(`H7:I${6 + plan.tasks.length}`).setNumberFormat("yyyy-mm-dd");
  s.getRange(`G7:G${6 + plan.tasks.length}`).conditionalFormats.add("containsText", { text: "Đã hoàn thành", format: { fill: colors.green, font: { color: "#375623", bold: true } } });
  s.getRange(`G7:G${6 + plan.tasks.length}`).conditionalFormats.add("containsText", { text: "Đang làm", format: { fill: colors.yellow, font: { color: "#7F6000", bold: true } } });
  s.freezePanes.freezeRows(6);
  s.getRange("A4:I4").format.rowHeight = 24;
  const widths = { A: 7, B: 16, C: 48, D: 30, E: 18, F: 10, G: 18, H: 14, I: 14, J: 24 };
  for (const [col, width] of Object.entries(widths)) s.getRange(`${col}:${col}`).format.columnWidth = width;
}

workbook.recalculate();
const inspect = await workbook.inspect({ kind: "table", range: "Tháng 1!A1:J16", include: "values,formulas", tableMaxRows: 16, tableMaxCols: 10 });
console.log(inspect.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "monthly workbook formula error scan" });
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/SEO-TONG-THE-PLAN-THEO-THANG.xlsx`);
for (const month of Object.keys(monthlyPlans)) {
  const preview = await workbook.render({ sheetName: month, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${month.replaceAll(" ", "-")}.png`, new Uint8Array(await preview.arrayBuffer()));
}
console.log(`Saved ${outputDir}/SEO-TONG-THE-PLAN-THEO-THANG.xlsx`);
