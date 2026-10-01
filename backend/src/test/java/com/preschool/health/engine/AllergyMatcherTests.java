package com.preschool.health.engine;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class AllergyMatcherTests {

	@Test
	void splitsNoteIntoKeywordsIgnoringAccentsAndPrefixes() {
		assertThat(AllergyMatcher.keywords("Dị ứng tôm, cua và sữa bò; không ăn được hành"))
			.containsExactly("tom", "cua", "sua bo", "hanh");
		assertThat(AllergyMatcher.keywords("  ")).isEmpty();
		assertThat(AllergyMatcher.keywords(null)).isEmpty();
	}

	@Test
	void matchesWholeWordsOnly() {
		List<String> k = AllergyMatcher.keywords("Dị ứng TÔM, sữa bò");
		assertThat(AllergyMatcher.match(k, "Tôm sú")).isEqualTo("tom");
		assertThat(AllergyMatcher.match(k, "Sữa bò tươi")).isEqualTo("sua bo");
		assertThat(AllergyMatcher.match(k, "Sữa đậu nành")).isNull();
		assertThat(AllergyMatcher.match(k, "Tomato")).isNull();
		assertThat(AllergyMatcher.match(List.of(), "Tôm")).isNull();
	}

}
