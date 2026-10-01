package com.preschool.account.entity;

/**
 * 7 vai trò theo docs/thiet-ke.md, mục "Vai trò và phân quyền". Vai trò nào cũng gán theo từng trường; hiệu trưởng là
 * vai trò cao nhất, phó hiệu trưởng giới hạn thêm theo {@link FunctionGroup}.
 */
public enum RoleCode {

	PRINCIPAL, VICE_PRINCIPAL, ACCOUNTANT, TEACHER, NURSE, KITCHEN, STAFF

}
