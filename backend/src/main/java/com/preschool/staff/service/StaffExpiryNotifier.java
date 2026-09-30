package com.preschool.staff.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.common.mail.EmailService;
import com.preschool.notification.service.NotificationService;
import com.preschool.staff.service.StaffExpiryQuery.Item;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

/**
 * Cảnh báo giấy tờ sắp hết hạn (hợp đồng, chứng chỉ, giấy khám sức khỏe…) trước {@value StaffService#EXPIRY_WARNING_DAYS}
 * ngày: thông báo trong app cho văn phòng điều hành và hiệu trưởng cơ sở, kèm một email tóm tắt các mục mới.
 * Chạy lại cùng ngày không tạo trùng (dedupe theo bản ghi + ngày hết hạn).
 */
@Service
public class StaffExpiryNotifier {

	static final String TYPE = "DOCUMENT_EXPIRING";

	private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	private final StaffExpiryQuery expiryQuery;

	private final UserRepository users;

	private final NotificationService notifications;

	private final EmailService emailService;

	public StaffExpiryNotifier(StaffExpiryQuery expiryQuery, UserRepository users, NotificationService notifications,
			EmailService emailService) {
		this.expiryQuery = expiryQuery;
		this.users = users;
		this.notifications = notifications;
		this.emailService = emailService;
	}

	/** Trả số thông báo mới đã tạo. */
	@Transactional
	public int run(LocalDate today) {
		List<Item> items = expiryQuery.find(null, today, today.plusDays(StaffService.EXPIRY_WARNING_DAYS), null,
				10_000, 0);
		List<User> chainAdmins = users.findActiveByRole(RoleCode.CHAIN_ADMIN, null);
		Map<java.util.UUID, List<User>> principalsBySchool = new LinkedHashMap<>();
		Map<User, List<String>> digest = new LinkedHashMap<>();
		int created = 0;

		for (Item item : items) {
			Set<User> recipients = new LinkedHashSet<>(chainAdmins);
			recipients.addAll(principalsBySchool.computeIfAbsent(item.schoolId(),
					school -> users.findActiveByRole(RoleCode.PRINCIPAL, school)));
			String title = "%s của %s hết hạn ngày %s".formatted(item.title(), item.staffName(),
					DATE.format(item.expiryDate()));
			String link = "/nhan-su/%s?tab=%s".formatted(item.staffId(), item.kind().tab());
			String dedupe = "expiring:%s:%s:%s".formatted(item.kind(), item.recordId(), item.expiryDate());
			for (User user : recipients) {
				if (notifications.notify(user.getId(), TYPE, title, "Mã nhân viên " + item.staffCode(), link, dedupe)) {
					created++;
					digest.computeIfAbsent(user, u -> new ArrayList<>()).add(title);
				}
			}
		}
		digest.forEach(this::sendDigest);
		return created;
	}

	private void sendDigest(User user, List<String> lines) {
		String text = "Các giấy tờ sắp hết hạn cần xử lý:\n\n- " + String.join("\n- ", lines)
				+ "\n\nXem chi tiết tại trang Nhân sự › Giấy tờ sắp hết hạn.";
		StringBuilder html = new StringBuilder("<p>Các giấy tờ sắp hết hạn cần xử lý:</p><ul>");
		lines.forEach(line -> html.append("<li>").append(HtmlUtils.htmlEscape(line)).append("</li>"));
		html.append("</ul><p>Xem chi tiết tại trang <b>Nhân sự › Giấy tờ sắp hết hạn</b>.</p>");
		emailService.send(user.getEmail(), "Giấy tờ nhân viên sắp hết hạn (" + lines.size() + ")", text,
				html.toString());
	}

}
