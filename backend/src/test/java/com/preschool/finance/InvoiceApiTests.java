package com.preschool.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.UUID;

import com.jayway.jsonpath.JsonPath;
import com.preschool.ApiTestSupport;
import com.preschool.TestData;
import com.preschool.account.entity.FunctionGroup;
import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.classroom.repository.AgeGroupRepository;
import com.preschool.finance.entity.FinanceEnums.CashSource;
import com.preschool.finance.entity.Invoice;
import com.preschool.finance.repository.CashEntryRepository;
import com.preschool.finance.repository.FeeTypeRepository;
import com.preschool.finance.repository.InvoiceRepository;
import com.preschool.school.entity.School;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Phiếu thu: sinh lại không trùng phiếu trẻ/tháng, phát hành cấp số, thanh toán nhiều lần (ghi sổ thu chi), trả thừa
 * chuyển sang tháng sau, hủy; cơ sở B không xem/sửa phiếu cơ sở A; hiệu trưởng chỉ thu tiền, giáo viên không xem.
 */
class InvoiceApiTests extends ApiTestSupport {

	private static final String SEPT = "2026-09-01";

	private static final String OCT = "2026-10-01";

	@Autowired
	AgeGroupRepository ageGroups;

	@Autowired
	FeeTypeRepository feeTypes;

	@Autowired
	InvoiceRepository invoices;

	@Autowired
	CashEntryRepository cashEntries;

	School schoolA;

	School schoolB;

	User accountantA;

	User accountantB;

	User principalA;

	User viceA;

	User teacherA;

	String childFull;

	String childMid;

	@BeforeEach
	void setUp() throws Exception {
		schoolA = data.school();
		schoolB = data.school();
		User admin = data.principal(schoolA, schoolB);
		accountantA = data.user(RoleCode.ACCOUNTANT, schoolA);
		accountantB = data.user(RoleCode.ACCOUNTANT, schoolB);
		principalA = data.user(RoleCode.PRINCIPAL, schoolA);
		viceA = data.vicePrincipal(schoolA, FunctionGroup.CLASSROOM);
		teacherA = data.user(RoleCode.TEACHER, schoolA);
		String year = JsonPath.read(as(admin, post("/api/v1/school-years").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"name":"I%s","startDate":"2026-08-15","endDate":"2027-05-31"}"""
				.formatted(UUID.randomUUID().toString().substring(0, 8)))).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString(), "$.id");
		String ageGroup = ageGroups.findByOrganizationIdAndCode(TestData.DEFAULT_ORG, "MAU_GIAO_4_5")
			.orElseThrow().getId().toString();
		String classA = JsonPath.read(as(principalA, post("/api/v1/classes").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"schoolYearId":"%s","ageGroupId":"%s","name":"Lá 1","capacity":30}""".formatted(year, ageGroup)),
				schoolA.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString(), "$.id");
		schedule(year, "HOC_PHI", 3_000_000);
		schedule(year, "TIEN_AN", 30_000);
		schedule(year, "CSVC", 500_000);
		childFull = child("Nguyễn Gia Bảo", "2026-09-01", classA);
		childMid = child("Trần Khánh Linh", "2026-09-16", classA);
	}

	private void schedule(String year, String code, long amount) throws Exception {
		as(accountantA, post("/api/v1/fee-schedules").contentType(MediaType.APPLICATION_JSON).content("""
				{"schoolYearId":"%s","feeTypeId":"%s","amount":%d,"effectiveFrom":"2026-08-01"}""".formatted(year,
				feeTypes.findByOrganizationIdAndCode(TestData.DEFAULT_ORG, code).orElseThrow().getId(), amount)), schoolA.getId())
			.andExpect(status().isCreated());
	}

	private String child(String name, String enrolledAt, String classId) throws Exception {
		return JsonPath.read(as(principalA, post("/api/v1/children").contentType(MediaType.APPLICATION_JSON).content("""
				{"profile":{"fullName":"%s","dob":"2021-03-10","gender":"MALE"},"enrolledAt":"%s","classId":"%s",
				"guardians":[]}""".formatted(name, enrolledAt, classId)), schoolA.getId())
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString(), "$.item.id");
	}

	private ResultActions generate(User user, School school, String month) throws Exception {
		return as(user, post("/api/v1/invoices/generate").contentType(MediaType.APPLICATION_JSON)
			.content("{\"month\":\"%s\"}".formatted(month)), school.getId());
	}

	private ResultActions issueAll(String month) throws Exception {
		return as(accountantA, post("/api/v1/invoices/issue").contentType(MediaType.APPLICATION_JSON)
			.content("{\"month\":\"%s\"}".formatted(month)), schoolA.getId());
	}

	private String invoiceOf(String childId, String month) {
		return invoices.findActive(UUID.fromString(childId), LocalDate.parse(month)).orElseThrow().getId().toString();
	}

	private ResultActions pay(User user, String invoiceId, long amount) throws Exception {
		return as(user, post("/api/v1/invoices/" + invoiceId + "/payments").contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"amount":%d,"method":"CASH","paidOn":"2026-09-20"}""".formatted(amount)), schoolA.getId());
	}

	@Test
	void generatingTwiceNeverDuplicatesChildMonth() throws Exception {
		generate(accountantA, schoolA, SEPT).andExpect(status().isOk())
			.andExpect(jsonPath("$.created").value(2))
			.andExpect(jsonPath("$.warnings[0].message").value("Chưa có biểu phí \"Đồng phục\" cho lớp của trẻ"));
		generate(accountantA, schoolA, "2026-09-15").andExpect(status().isOk())
			.andExpect(jsonPath("$.created").value(0))
			.andExpect(jsonPath("$.updated").value(2));
		as(accountantA, get("/api/v1/invoices").param("month", SEPT), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(2))
			.andExpect(jsonPath("$.items[0].status").value("DRAFT"));

		String full = invoiceOf(childFull, SEPT);
		as(accountantA, get("/api/v1/invoices/" + full), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.lines[0].description").value("Học phí"))
			.andExpect(jsonPath("$.lines[0].amount").value(3_000_000))
			.andExpect(jsonPath("$.lines[*].description").value(hasItem("Cơ sở vật chất")));
		as(accountantA, get("/api/v1/invoices/" + invoiceOf(childMid, SEPT)), schoolA.getId())
			.andExpect(jsonPath("$.lines[0].note").value(org.hamcrest.Matchers.containsString("ngày học")))
			.andExpect(jsonPath("$.invoice.subtotal").value(org.hamcrest.Matchers.lessThan(3_500_000 + 30_000 * 26)));

		Invoice duplicate = new Invoice(schoolA.getId(), UUID.fromString(childFull), LocalDate.parse(SEPT));
		assertThatThrownBy(() -> invoices.saveAndFlush(duplicate)).isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void otherSchoolAndOtherRolesCannotTouchInvoices() throws Exception {
		generate(viceA, schoolA, SEPT).andExpect(status().isForbidden());
		generate(accountantB, schoolA, SEPT).andExpect(status().isForbidden());
		generate(accountantA, schoolA, SEPT).andExpect(status().isOk());
		String id = invoiceOf(childFull, SEPT);

		as(accountantB, get("/api/v1/invoices").param("month", SEPT), schoolB.getId())
			.andExpect(jsonPath("$.totalElements").value(0));
		as(accountantB, get("/api/v1/invoices/" + id), schoolB.getId()).andExpect(status().isNotFound());
		as(accountantB, post("/api/v1/invoices/" + id + "/issue"), schoolB.getId()).andExpect(status().isNotFound());
		as(accountantB, get("/api/v1/invoices/" + id + "/pdf"), schoolB.getId()).andExpect(status().isNotFound());
		as(accountantB, get("/api/v1/children/" + childFull + "/invoices"), schoolB.getId())
			.andExpect(status().isNotFound());
		as(teacherA, get("/api/v1/invoices").param("month", SEPT), schoolA.getId()).andExpect(status().isForbidden());
		as(teacherA, get("/api/v1/invoices/" + id), schoolA.getId()).andExpect(status().isNotFound());

		as(principalA, get("/api/v1/invoices/" + id), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.canManage").value(true))
			.andExpect(jsonPath("$.canCollect").value(true));
		as(viceA, get("/api/v1/invoices/" + id), schoolA.getId()).andExpect(status().isNotFound());
		as(viceA, post("/api/v1/invoices/" + id + "/issue"), schoolA.getId()).andExpect(status().isNotFound());
	}

	@Test
	void paymentsInSeveralTimesAndOverpaymentCarriesToNextMonth() throws Exception {
		generate(accountantA, schoolA, SEPT).andExpect(status().isOk());
		issueAll(SEPT).andExpect(jsonPath("$.issued").value(2));
		generate(accountantA, schoolA, SEPT).andExpect(jsonPath("$.skipped").value(2));
		String id = invoiceOf(childFull, SEPT);
		String body = as(accountantA, get("/api/v1/invoices/" + id), schoolA.getId())
			.andExpect(jsonPath("$.invoice.invoiceNo").value(startsWith("HP2609-")))
			.andExpect(jsonPath("$.invoice.status").value("ISSUED"))
			.andReturn()
			.getResponse()
			.getContentAsString();
		long due = ((Number) JsonPath.read(body, "$.invoice.amountDue")).longValue();

		String afterFirst = pay(principalA, id, 1_000_000).andExpect(status().isCreated())
			.andExpect(jsonPath("$.invoice.status").value("PARTIAL"))
			.andExpect(jsonPath("$.invoice.balance").value(due - 1_000_000))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String firstPayment = JsonPath.read(afterFirst, "$.payments[0].id");
		assertThat(cashEntries.findBySourceAndSourceId(CashSource.PAYMENT, UUID.fromString(firstPayment))).isPresent();

		pay(accountantA, id, due - 1_000_000 + 200_000).andExpect(jsonPath("$.invoice.status").value("PAID"))
			.andExpect(jsonPath("$.invoice.balance").value(-200_000));
		as(viceA, post("/api/v1/invoices/" + id + "/payments/" + firstPayment + "/void")
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\"Nhập nhầm\"}"), schoolA.getId()).andExpect(status().isNotFound());
		as(accountantA, post("/api/v1/invoices/" + id + "/payments/" + firstPayment + "/void")
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\"Nhập nhầm\"}"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.invoice.status").value("PARTIAL"))
			.andExpect(jsonPath("$.invoice.balance").value(800_000));
		assertThat(cashEntries.findBySourceAndSourceId(CashSource.PAYMENT, UUID.fromString(firstPayment))).isEmpty();
		pay(accountantA, id, 1_000_000).andExpect(jsonPath("$.invoice.balance").value(-200_000));
		as(accountantA, post("/api/v1/invoices/" + id + "/cancel").contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\"Sai\"}"), schoolA.getId()).andExpect(status().isConflict());

		generate(accountantA, schoolA, OCT).andExpect(status().isOk());
		String oct = invoiceOf(childFull, OCT);
		as(accountantA, get("/api/v1/invoices/" + oct), schoolA.getId())
			.andExpect(jsonPath("$.invoice.carriedBalance").value(-200_000))
			.andExpect(jsonPath("$.lines[*].description").value(hasItem("Trả thừa kỳ trước")))
			.andExpect(jsonPath("$.lines[*].description").value(not(hasItem("Cơ sở vật chất"))));
		as(accountantA, post("/api/v1/invoices/" + oct + "/issue"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.invoice.invoiceNo").value(startsWith("HP2610-")));
		as(accountantA, get("/api/v1/invoices/" + id), schoolA.getId())
			.andExpect(jsonPath("$.invoice.status").value("CARRIED"))
			.andExpect(jsonPath("$.carriedToId").value(oct));
		pay(accountantA, id, 10_000).andExpect(status().isConflict());
		as(accountantA, post("/api/v1/invoices/" + id + "/cancel").contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\"Sai\"}"), schoolA.getId()).andExpect(status().isConflict());

		as(accountantA, post("/api/v1/invoices/" + oct + "/cancel").contentType(MediaType.APPLICATION_JSON)
			.content("{}"), schoolA.getId()).andExpect(status().isBadRequest());
		as(accountantA, post("/api/v1/invoices/" + oct + "/cancel").contentType(MediaType.APPLICATION_JSON)
			.content("{\"reason\":\"Sinh lại\"}"), schoolA.getId()).andExpect(status().isNoContent());
		as(accountantA, get("/api/v1/invoices/" + id), schoolA.getId())
			.andExpect(jsonPath("$.invoice.status").value("PAID"));
		generate(accountantA, schoolA, OCT).andExpect(jsonPath("$.created").value(1))
			.andExpect(jsonPath("$.updated").value(1));

		as(principalA, get("/api/v1/invoices/summary").param("month", SEPT), schoolA.getId())
			.andExpect(jsonPath("$.total").value(2))
			.andExpect(jsonPath("$.paid").value(1));
		as(principalA, get("/api/v1/children/" + childFull + "/invoices"), schoolA.getId())
			.andExpect(jsonPath("$[*].periodMonth").value(hasItem(SEPT)));
	}

	@Test
	void cancelledDraftCanBeRegeneratedAndDocumentsDownload() throws Exception {
		generate(accountantA, schoolA, SEPT).andExpect(status().isOk());
		String draft = invoiceOf(childMid, SEPT);
		as(accountantA, post("/api/v1/invoices/" + draft + "/cancel"), schoolA.getId())
			.andExpect(status().isNoContent());
		as(accountantA, get("/api/v1/invoices").param("month", SEPT), schoolA.getId())
			.andExpect(jsonPath("$.totalElements").value(1));
		generate(accountantA, schoolA, SEPT).andExpect(jsonPath("$.created").value(1));

		as(accountantA, post("/api/v1/invoices/issue").contentType(MediaType.APPLICATION_JSON)
			.content("{\"month\":\"%s\",\"ids\":[\"%s\"]}".formatted(SEPT, invoiceOf(childMid, SEPT))),
				schoolA.getId())
			.andExpect(jsonPath("$.issued").value(1));
		byte[] pdf = as(principalA, get("/api/v1/invoices/" + invoiceOf(childMid, SEPT) + "/pdf"), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(content().contentType(MediaType.APPLICATION_PDF))
			.andReturn()
			.getResponse()
			.getContentAsByteArray();
		assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
		as(accountantA, get("/api/v1/invoices/export").param("month", SEPT).param("q", "khanh"), schoolA.getId())
			.andExpect(status().isOk());
		as(accountantA, get("/api/v1/invoices").param("month", SEPT).param("q", "khanh"), schoolA.getId())
			.andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.items[0].status").value("ISSUED"));
		as(accountantA, get("/api/v1/invoices").param("month", SEPT).param("status", "DRAFT"), schoolA.getId())
			.andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.items[0].childId").value(childFull));
	}

	@Test
	void receivablesListChildrenWithOpenDebtAndPaymentEntriesAreReadOnly() throws Exception {
		generate(accountantA, schoolA, SEPT).andExpect(status().isOk());
		issueAll(SEPT).andExpect(jsonPath("$.issued").value(2));
		String full = invoiceOf(childFull, SEPT);
		String paid = pay(accountantA, full, 1_000_000).andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		long balance = ((Number) JsonPath.read(paid, "$.invoice.balance")).longValue();

		as(principalA, get("/api/v1/receivables"), schoolA.getId()).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(2));
		as(accountantA, get("/api/v1/receivables").param("q", "gia bao"), schoolA.getId())
			.andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.items[0].childId").value(childFull))
			.andExpect(jsonPath("$.items[0].invoiceCount").value(1))
			.andExpect(jsonPath("$.items[0].balance").value(balance))
			.andExpect(jsonPath("$.items[0].latestInvoiceId").value(full));
		as(accountantA, get("/api/v1/receivables/summary"), schoolA.getId())
			.andExpect(jsonPath("$.children").value(2));
		as(accountantB, get("/api/v1/receivables"), schoolB.getId()).andExpect(jsonPath("$.totalElements").value(0));
		as(accountantB, get("/api/v1/receivables"), schoolA.getId()).andExpect(status().isForbidden());
		as(teacherA, get("/api/v1/receivables"), schoolA.getId()).andExpect(status().isForbidden());

		pay(accountantA, full, balance).andExpect(jsonPath("$.invoice.status").value("PAID"));
		as(accountantA, get("/api/v1/receivables").param("q", "gia bao"), schoolA.getId())
			.andExpect(jsonPath("$.totalElements").value(0));

		String entries = as(accountantA, get("/api/v1/cash-entries").param("q", "gia bao"), schoolA.getId())
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(2))
			.andExpect(jsonPath("$.items[0].source").value("PAYMENT"))
			.andExpect(jsonPath("$.items[0].invoiceId").value(full))
			.andReturn()
			.getResponse()
			.getContentAsString();
		String entryId = JsonPath.read(entries, "$.items[0].id");
		as(accountantA, delete("/api/v1/cash-entries/" + entryId), schoolA.getId()).andExpect(status().isConflict());
		as(accountantA, get("/api/v1/cash-entries/summary"), schoolA.getId())
			.andExpect(jsonPath("$.totalIn").value(1_000_000 + balance));
	}

}
