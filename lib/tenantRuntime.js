let companyId = "";

export function setActiveCompanyId(value) { companyId = String(value || ""); }
export function getActiveCompanyId() { return companyId; }
