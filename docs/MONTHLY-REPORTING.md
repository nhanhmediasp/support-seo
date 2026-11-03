# Dữ liệu và báo cáo theo tháng

GSC, GA4 và thư viện báo cáo dùng chung tháng đang chọn trong phiên làm việc. Tháng đã kết thúc so với toàn bộ tháng trước; tháng đang chạy so với cùng ngày của tháng trước, giới hạn theo số ngày thực tế của tháng đó. Ngày hiện tại lấy theo múi giờ Việt Nam.

## Nhập dữ liệu

- Chọn khoảng ngày, mở ZIP/CSV và xem trước trước khi lưu. Ngày trong file được ưu tiên nếu nhận diện được: bảng ngày GSC hoặc dòng `# Start date` / `# End date` và bản tiếng Việt của GA4.
- Nếu file chỉ chứa tổng theo từ khóa/kênh/trang và không có kỳ, khoảng ngày nhập là kỳ người dùng xác định. Kiểm tra cả website và các bộ lọc trong file nguồn.
- Tải backup toàn bộ workspace đang mở ngay từ màn xem trước. Có thể khôi phục bằng chức năng backup JSON trong Cài đặt. Nút hoàn tác lần nhập hoạt động trong phân hệ hiện tại khi dữ liệu chưa bị thay đổi tiếp.
- Nhập lại thay bộ dữ liệu tương ứng trong kỳ, kể cả các từ khóa/kênh/trang không còn trong file mới. Các kỳ khác được giữ lại. File chỉ có tổng quan GA4 giữ bảng kênh và trang; file snapshot GA4 đầy đủ thay toàn bộ bộ dữ liệu GA4 của kỳ.
- Khi tháng đang chạy dài thêm, một kỳ mới bao trọn kỳ cũ có thể cập nhật kỳ cũ. Không cho thay một phần của tổng hợp có phần dữ liệu nằm ngoài kỳ nhập, vì không thể chia số liệu đó một cách chính xác.
- Đồng bộ GSC dùng tháng đang chọn và cùng bước xem trước, đồng thời lấy tổng hiệu suất theo ngày tách khỏi bảng query/page. Không thay toàn bộ lịch sử. Phân trang tối đa 200.000 dòng; nếu vẫn còn dữ liệu thì trả lỗi thay vì ghi bộ dữ liệu bị cắt.
- CSV xuất từ GSC/GA4 chỉ gồm kỳ đang xem và giữ metadata kỳ/loại dữ liệu. Backup JSON giữ dữ liệu đầy đủ.

## Cách so sánh

- Số lượng: `(kỳ này − kỳ trước) / kỳ trước × 100%`, kèm chênh lệch tuyệt đối.
- CTR và engagement rate: chênh lệch điểm phần trăm. Thứ hạng: số bậc, vị trí nhỏ hơn tốt hơn.
- Mẫu số bằng 0: “Phát sinh mới”; thiếu dữ liệu: “Chưa đủ dữ liệu so sánh”. Số 0 có trong nguồn vẫn là 0.
- Chỉ tính tăng giảm hiệu suất khi cả hai kỳ được phủ đủ. Tổng cả tháng không được sử dụng để suy ra một vài ngày. Các tổng GSC theo truy vấn chỉ so với cùng loại tổng theo truy vấn; tổng hiệu suất chỉ so với tổng hiệu suất.
- GSC ưu tiên tổng theo ngày, tính CTR từ tổng clicks/impressions và vị trí theo trọng số impressions. Không cộng tổng ngày với các dòng query/page.
- GA4 ưu tiên tổng quan đúng kỳ. Không cộng số người dùng giữa các kênh, trang hoặc tháng. File không có chỉ số cần thiết hiển thị thiếu dữ liệu; snapshot không dùng số event `user_engagement` thay cho engaged sessions, hoặc số người dùng 30 ngày thay cho người dùng của tháng báo cáo.
- Dữ liệu cũ chỉ có ngày vẫn được giữ và hiển thị theo ngày đó; không tự suy diễn là dữ liệu cả tháng. Nhập lại với kỳ xác định để có so sánh đầy đủ.

## KPI và báo cáo đã chốt

KPI công việc dùng ngày hoàn thành, bài viết dùng ngày đăng. Bản ghi thiếu ngày cần thiết được liệt kê số lượng ở nhóm “Chưa xác định kỳ” trong trình soạn thảo và không tính vào mọi tháng. Có thể đặt mục tiêu cho từng chỉ số trong báo cáo.

Báo cáo đã lưu giữ snapshot kỳ hiện tại, snapshot kỳ so sánh, mục tiêu, ảnh, nhận xét và chữ ký. Import mới không thay các snapshot này. Muốn lấy dữ liệu mới, dùng **Lấy dữ liệu mới · Tạo phiên bản mới**; bản cũ được giữ, bản mới cần kiểm tra lại nhận xét/ảnh và xác nhận lại chữ ký. Không còn giới hạn tự cắt danh sách xuống 24 báo cáo. Báo cáo cũ chưa có snapshot kỳ trước không tự lấy dữ liệu mới để dựng lại phần trăm lịch sử.

## Kiểm chứng

`npm test` kiểm tra tính tăng giảm, lịch tháng/năm nhuận, độ phủ kỳ, chỉ số không cộng được, chống trùng, thay thế theo kỳ, bảo toàn dữ liệu ngoài kỳ và snapshot. `npm run check` chạy TypeScript và build production.

Tham chiếu định nghĩa nguồn: [GSC Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [GA4 dimensions and metrics](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema).

## So sánh bằng báo cáo đã lưu

Trong thư viện hoặc trình sửa báo cáo, chọn **So sánh với báo cáo**. Các ô tổng quan hiển thị số liệu hiện tại, số liệu báo cáo được chọn và mức tăng giảm. Chỉ đối chiếu 15 chỉ số chính trong phần tổng quan, gồm GSC, thứ hạng Top 3/10, traffic GA4 và kết quả công việc; không hiển thị lại bảng KPI dài phía trên.

Chế độ này dùng trực tiếp snapshot của hai báo cáo, kể cả dữ liệu nhập cũ chưa có metadata kỳ. Tên và ngày của báo cáo so sánh được ghi rõ; người dùng chọn các báo cáo có phạm vi và bộ lọc phù hợp. Không tự quy đổi báo cáo khác độ dài thành mức tăng theo tháng. Chỉ số Google bị thiếu vẫn là thiếu; số 0 có trong báo cáo vẫn được giữ.

Lựa chọn và bản sao dữ liệu đối chiếu được lưu cùng báo cáo, nên mở lại hoặc xóa báo cáo nguồn không làm mất số liệu so sánh đã lưu. Chọn **Không so sánh** để chỉ hiển thị kết quả hiện tại. Các màn GSC/GA4 riêng vẫn dùng so sánh theo kỳ như trước.
