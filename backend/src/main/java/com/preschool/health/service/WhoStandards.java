package com.preschool.health.service;

import com.preschool.health.engine.GrowthClassifier;
import com.preschool.health.engine.GrowthClassifier.Lms;
import com.preschool.health.engine.GrowthClassifier.Tables;
import com.preschool.health.entity.WhoGrowthStandard;
import com.preschool.health.repository.WhoGrowthStandardRepository;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Bảng chuẩn WHO nạp một lần từ DB rồi giữ trong bộ nhớ (dữ liệu chỉ đổi qua migration). */
@Component
public class WhoStandards {

	private final WhoGrowthStandardRepository repository;

	private volatile GrowthClassifier classifier;

	public WhoStandards(WhoGrowthStandardRepository repository) {
		this.repository = repository;
	}

	@Transactional(readOnly = true)
	public GrowthClassifier classifier() {
		GrowthClassifier c = classifier;
		if (c == null) {
			synchronized (this) {
				if (classifier == null) {
					Tables tables = new Tables();
					for (WhoGrowthStandard row : repository.findAll()) {
						tables.put(row.getIndicator(), row.getGender(), row.getAgeUnit(), row.getAge(),
								new Lms(row.getL().doubleValue(), row.getM().doubleValue(), row.getS().doubleValue()));
					}
					classifier = new GrowthClassifier(tables);
				}
				c = classifier;
			}
		}
		return c;
	}

}
