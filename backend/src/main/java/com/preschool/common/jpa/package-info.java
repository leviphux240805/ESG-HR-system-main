/**
 * Hạ tầng JPA dùng chung. Filter {@code schoolFilter}: dòng có school_id rỗng (dùng chung trong tổ chức) luôn qua,
 * còn lại phải thuộc các trường đang chọn. Filter {@code organizationFilter}: dòng thuộc tổ chức của người dùng
 * (gắn cho bảng có dòng dùng chung và danh mục của tổ chức). {@code applyToLoadByKey} để cả {@code findById} cũng
 * bị lọc.
 */
@FilterDef(name = SchoolFilter.NAME, parameters = @ParamDef(name = SchoolFilter.PARAM, type = UUID.class),
		defaultCondition = "(school_id IS NULL OR school_id IN (:" + SchoolFilter.PARAM + "))", applyToLoadByKey = true)
@FilterDef(name = OrganizationFilter.NAME, parameters = @ParamDef(name = OrganizationFilter.PARAM, type = UUID.class),
		defaultCondition = "organization_id = :" + OrganizationFilter.PARAM, applyToLoadByKey = true)
package com.preschool.common.jpa;

import java.util.UUID;

import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;
