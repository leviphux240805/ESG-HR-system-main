package com.preschool.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.preschool.account.entity.RoleCode;
import com.preschool.account.entity.User;
import com.preschool.account.repository.UserRepository;
import com.preschool.account.service.ProductionAdminBootstrap;
import com.preschool.school.entity.School;
import com.preschool.school.repository.SchoolRepository;

import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

class ProductionAdminBootstrapTests {

	private static final UUID ORGANIZATION_ID = UUID.fromString("7d3c0b8e-5a41-4c2e-9f1a-0b5c0a000001");

	@Test
	void createsPrincipalWithEncodedTemporaryPasswordAcrossPbcSchools() throws Exception {
		UserRepository users = org.mockito.Mockito.mock(UserRepository.class);
		SchoolRepository schools = org.mockito.Mockito.mock(SchoolRepository.class);
		PasswordEncoder encoder = org.mockito.Mockito.mock(PasswordEncoder.class);
		List<School> pbcSchools = pbcSchools();
		when(schools.findAllByOrganizationIdAndActiveTrueOrderByCode(ORGANIZATION_ID)).thenReturn(pbcSchools);
		when(users.findByEmail("principal@example.test")).thenReturn(Optional.empty());
		when(encoder.encode("Bootstrap-Pass-2026")).thenReturn("bcrypt-hash");
		when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		ProductionAdminBootstrap bootstrap = new ProductionAdminBootstrap(users, schools, encoder,
				"Principal@Example.Test", "Bootstrap-Pass-2026");
		bootstrap.run(new DefaultApplicationArguments(new String[0]));

		var saved = org.mockito.ArgumentCaptor.forClass(User.class);
		verify(users).save(saved.capture());
		User user = saved.getValue();
		assertThat(user.getEmail()).isEqualTo("principal@example.test");
		assertThat(user.getPasswordHash()).isEqualTo("bcrypt-hash");
		assertThat(user.isMustChangePassword()).isTrue();
		assertThat(user.getRoles()).hasSize(3).allSatisfy(role -> {
			assertThat(role.getRoleCode()).isEqualTo(RoleCode.PRINCIPAL);
			assertThat(pbcSchools).extracting(School::getId).contains(role.getSchoolId());
		});
	}

	@Test
	void existingPrincipalKeepsChangedPasswordAndRolesAreNotDuplicated() throws Exception {
		UserRepository users = org.mockito.Mockito.mock(UserRepository.class);
		SchoolRepository schools = org.mockito.Mockito.mock(SchoolRepository.class);
		PasswordEncoder encoder = org.mockito.Mockito.mock(PasswordEncoder.class);
		List<School> pbcSchools = pbcSchools();
		User user = new User(ORGANIZATION_ID, "principal@example.test", null, "Hiệu trưởng", "old-hash");
		user.changePassword("changed-hash");
		user.addRole(RoleCode.PRINCIPAL, pbcSchools.get(0).getId());
		when(schools.findAllByOrganizationIdAndActiveTrueOrderByCode(ORGANIZATION_ID)).thenReturn(pbcSchools);
		when(users.findByEmail("principal@example.test")).thenReturn(Optional.of(user));
		when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

		ProductionAdminBootstrap bootstrap = new ProductionAdminBootstrap(users, schools, encoder,
				"principal@example.test", "Bootstrap-Pass-2026");
		bootstrap.run(new DefaultApplicationArguments(new String[0]));

		assertThat(user.getPasswordHash()).isEqualTo("changed-hash");
		assertThat(user.isMustChangePassword()).isFalse();
		assertThat(user.getRoles()).hasSize(3);
		verify(encoder, never()).encode(any());
	}

	@Test
	void rejectsBootstrapEmailOwnedByAnotherOrganization() throws Exception {
		UserRepository users = org.mockito.Mockito.mock(UserRepository.class);
		SchoolRepository schools = org.mockito.Mockito.mock(SchoolRepository.class);
		PasswordEncoder encoder = org.mockito.Mockito.mock(PasswordEncoder.class);
		User user = new User(UUID.randomUUID(), "principal@example.test", null, "Khác tổ chức", "hash");
		List<School> pbcSchools = pbcSchools();
		when(schools.findAllByOrganizationIdAndActiveTrueOrderByCode(ORGANIZATION_ID)).thenReturn(pbcSchools);
		when(users.findByEmail("principal@example.test")).thenReturn(Optional.of(user));

		ProductionAdminBootstrap bootstrap = new ProductionAdminBootstrap(users, schools, encoder,
				"principal@example.test", "Bootstrap-Pass-2026");
		assertThatThrownBy(() -> bootstrap.run(new DefaultApplicationArguments(new String[0])))
			.isInstanceOf(IllegalStateException.class)
			.hasMessageContaining("tổ chức khác");
		verify(users, never()).save(any(User.class));
	}

	private static List<School> pbcSchools() {
		return List.of(mockSchool("PBC"), mockSchool("PBC-PH1"), mockSchool("PBC-PH2"));
	}

	private static School mockSchool(String code) {
		School school = org.mockito.Mockito.mock(School.class);
		when(school.getCode()).thenReturn(code);
		when(school.getId()).thenReturn(UUID.randomUUID());
		return school;
	}

}