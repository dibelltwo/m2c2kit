function toAssessmentConfig(pkg) {
    return pkg.assessments.map((assessment) => ({
        activity_id: assessment.activity_id,
        activity_version: assessment.activity_version,
        parameters: assessment.parameters,
        order: assessment.order,
        selection_strategy: "all",
    }));
}
function buildSurveyFromQuestionBank(protocol, pkg) {
    const questionBank = protocol.question_bank ?? [];
    const selectedIds = new Set(pkg.survey_item_refs.map((item) => item.item_id));
    const items = questionBank
        .filter((item) => selectedIds.has(item.item_id) && item.status !== "hidden")
        .map(({ status: _status, ...item }) => item);
    return {
        ...protocol.ema_survey,
        survey_id: pkg.package_id,
        survey_version: pkg.package_version,
        title: pkg.package_name,
        items,
    };
}
export function getAvailablePackages(protocol) {
    return protocol.packages ?? [];
}
export function getDefaultPackage(protocol) {
    if (!protocol.packages || protocol.packages.length === 0) {
        return null;
    }
    if (protocol.default_package_id) {
        return (protocol.packages.find((candidate) => candidate.package_id === protocol.default_package_id) ?? protocol.packages[0]);
    }
    return protocol.packages[0];
}
export function getAssessmentConfigsForPackage(protocol, packageId) {
    const pkg = (packageId &&
        protocol.packages?.find((candidate) => candidate.package_id === packageId)) ??
        getDefaultPackage(protocol);
    if (!pkg) {
        return protocol.assessments;
    }
    return toAssessmentConfig(pkg);
}
export function getSurveyConfigForPackage(protocol, packageId) {
    const pkg = (packageId &&
        protocol.packages?.find((candidate) => candidate.package_id === packageId)) ??
        getDefaultPackage(protocol);
    if (!pkg || !protocol.question_bank) {
        return protocol.ema_survey;
    }
    return buildSurveyFromQuestionBank(protocol, pkg);
}
