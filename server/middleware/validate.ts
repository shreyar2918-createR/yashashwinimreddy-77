import { type ZodSchema, ZodError } from "zod";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details: Record<string, string[]>;
  };
}

export async function validateRequestBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<ValidationResult<T>> {
  try {
    const raw = await request.json();
    const result = schema.safeParse(raw);

    if (result.success) {
      return { success: true, data: result.data };
    }

    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "root";
      if (!fieldErrors[path]) fieldErrors[path] = [];
      fieldErrors[path].push(issue.message);
    }

    return {
      success: false,
      error: {
        message: "Request validation failed",
        details: fieldErrors,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        message: "Malformed JSON payload",
        details: { body: [err instanceof Error ? err.message : "Invalid JSON"] },
      },
    };
  }
}
