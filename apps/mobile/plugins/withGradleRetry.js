const { withGradleProperties, withProjectBuildGradle } = require('@expo/config-plugins');

const RETRY_PROPS = [
  ['org.gradle.internal.http.socketTimeout', '180000'],
  ['org.gradle.internal.http.connectionTimeout', '180000'],
  ['org.gradle.internal.repository.max.retries', '12'],
  ['org.gradle.internal.repository.initial.backoff', '500'],
  ['org.gradle.internal.repository.max.backoff', '12000'],
];

const MAVEN_MIRROR = 'https://maven-central.storage-download.googleapis.com/maven2/';

module.exports = function withGradleRetry(config) {
  config = withGradleProperties(config, (config) => {
    for (const [key, value] of RETRY_PROPS) {
      const existing = config.modResults.find((p) => p.key === key);
      if (existing) existing.value = value;
      else config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });

  config = withProjectBuildGradle(config, (config) => {
    const source = config.modResults.contents;
    if (!source.includes(MAVEN_MIRROR)) {
      const mirrorBlock = `maven { url '${MAVEN_MIRROR}' }`;
      config.modResults.contents = source.replace(
        /mavenCentral\(\)/g,
        `mavenCentral()\n    ${mirrorBlock}`
      );
    }
    return config;
  });

  return config;
};
