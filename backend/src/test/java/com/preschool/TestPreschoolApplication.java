package com.preschool;

import org.springframework.boot.SpringApplication;

public class TestPreschoolApplication {

	public static void main(String[] args) {
		SpringApplication.from(PreschoolApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
