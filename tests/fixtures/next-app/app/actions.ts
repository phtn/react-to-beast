"use server";

export async function saveProject(formData: FormData) {
  return { name: String(formData.get("name")) };
}
