package com.preschool.account.entity;

/** 8 vai trò theo docs/thiet-ke.md, mục "Vai trò và phân quyền". */
public enum RoleCode {

	OWNER(Scope.CHAIN),
	CHAIN_ADMIN(Scope.CHAIN),
	ACCOUNTANT(Scope.CHAIN_OR_SCHOOL),
	PRINCIPAL(Scope.SCHOOL),
	TEACHER(Scope.SCHOOL),
	NURSE(Scope.SCHOOL),
	KITCHEN(Scope.SCHOOL),
	STAFF(Scope.SCHOOL);

	public enum Scope {
		CHAIN, CHAIN_OR_SCHOOL, SCHOOL
	}

	private final Scope scope;

	RoleCode(Scope scope) {
		this.scope = scope;
	}

	public Scope scope() {
		return scope;
	}

}
