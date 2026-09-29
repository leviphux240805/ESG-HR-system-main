package com.preschool.common.jpa;

/**
 * Tên và tham số của Hibernate filter lọc dữ liệu theo cơ sở (định nghĩa trong {@code package-info.java}). Entity
 * nghiệp vụ gắn {@code @Filter(name = SchoolFilter.NAME)}; filter được bật tự động cho mọi EntityManager bởi
 * {@link SchoolFilterInitializer}.
 */
public final class SchoolFilter {

	public static final String NAME = "schoolFilter";

	public static final String PARAM = "schoolIds";

	private SchoolFilter() {
	}

}
