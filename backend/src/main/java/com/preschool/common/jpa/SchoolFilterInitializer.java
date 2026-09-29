package com.preschool.common.jpa;

import java.util.Set;
import java.util.UUID;

import com.preschool.security.SchoolScope;

import jakarta.persistence.EntityManager;

import org.hibernate.Session;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.orm.jpa.AbstractEntityManagerFactoryBean;

/**
 * Bật {@link SchoolFilter} cho MỌI EntityManager ngay khi được tạo, theo {@link SchoolScope} của request: cả trong
 * transaction lẫn truy vấn không có transaction (query method tự khai báo của Spring Data mặc định không mở
 * transaction). Nhờ vậy quên thêm điều kiện school_id cũng không lộ dữ liệu cơ sở khác. Không có scope (đăng nhập,
 * job nền) hoặc vai trò cấp chuỗi chọn "Tất cả cơ sở" thì không lọc.
 */
@Configuration
public class SchoolFilterInitializer {

	/** UUID không thuộc cơ sở nào, dùng khi tập cơ sở rỗng để câu IN () vẫn hợp lệ và không khớp dòng nào. */
	private static final UUID NO_SCHOOL = new UUID(0, 0);

	@Bean
	static BeanPostProcessor schoolFilterEntityManagerInitializer() {
		return new BeanPostProcessor() {
			@Override
			public Object postProcessBeforeInitialization(Object bean, String beanName) {
				if (bean instanceof AbstractEntityManagerFactoryBean emfBean) {
					emfBean.setEntityManagerInitializer(SchoolFilterInitializer::enableFilter);
				}
				return bean;
			}
		};
	}

	static void enableFilter(EntityManager entityManager) {
		SchoolScope.current().flatMap(SchoolScope::filterSchoolIds).ifPresent(schoolIds -> {
			Set<UUID> ids = schoolIds.isEmpty() ? Set.of(NO_SCHOOL) : schoolIds;
			entityManager.unwrap(Session.class).enableFilter(SchoolFilter.NAME).setParameterList(SchoolFilter.PARAM, ids);
		});
	}

}
