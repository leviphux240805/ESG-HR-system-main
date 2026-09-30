package com.preschool.staff.mapper;

import com.preschool.staff.dto.StaffDtos.BankInfo;
import com.preschool.staff.dto.StaffDtos.LinkedAccount;
import com.preschool.staff.dto.StaffDtos.StaffDetail;
import com.preschool.staff.dto.StaffDtos.StaffFields;
import com.preschool.staff.dto.StaffDtos.StaffPermissions;
import com.preschool.staff.entity.Staff;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.mapstruct.ReportingPolicy;

@Mapper(unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface StaffMapper {

	@Mapping(target = "id", source = "staff.id")
	@Mapping(target = "email", source = "staff.email")
	@Mapping(target = "bank", source = "bank")
	@Mapping(target = "account", source = "account")
	@Mapping(target = "permissions", source = "permissions")
	@Mapping(target = "schoolName", source = "schoolName")
	@Mapping(target = "photoUrl", source = "photoUrl")
	StaffDetail toDetail(Staff staff, String schoolName, String photoUrl, BankInfo bank, LinkedAccount account,
			StaffPermissions permissions);

	/** Các trường hồ sơ (dùng làm snapshot audit và dữ liệu form). */
	StaffFields toFields(Staff staff);

	/** Ghi các trường hồ sơ vào entity (không đụng cơ sở, trạng thái, lương, ngân hàng). */
	void apply(StaffFields fields, @MappingTarget Staff staff);

	default BankInfo toBank(Staff staff) {
		return new BankInfo(staff.getBankName(), staff.getBankAccountNo(), staff.getBankAccountHolder());
	}

}
