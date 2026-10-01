package com.preschool.common.jpa;

/**
 * Tên và tham số của Hibernate filter lọc theo tổ chức (định nghĩa trong {@code package-info.java}). Gắn
 * {@code @Filter(name = OrganizationFilter.NAME)} cho entity kế thừa {@link OrganizationEntity}; bật cùng
 * {@link SchoolFilter} bởi {@link SchoolFilterInitializer}.
 */
public final class OrganizationFilter {

	public static final String NAME = "organizationFilter";

	public static final String PARAM = "organizationId";

	private OrganizationFilter() {
	}

}
