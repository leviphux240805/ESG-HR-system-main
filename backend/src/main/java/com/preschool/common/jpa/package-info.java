/**
 * Hạ tầng JPA dùng chung. Filter {@code schoolFilter}: dòng có school_id rỗng (dùng chung toàn chuỗi) luôn hiển thị;
 * {@code applyToLoadByKey} để cả {@code findById} cũng bị lọc.
 */
@FilterDef(name = SchoolFilter.NAME, parameters = @ParamDef(name = SchoolFilter.PARAM, type = UUID.class),
		defaultCondition = "(school_id IS NULL OR school_id IN (:" + SchoolFilter.PARAM + "))", applyToLoadByKey = true)
package com.preschool.common.jpa;

import java.util.UUID;

import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;
