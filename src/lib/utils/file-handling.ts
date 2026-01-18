/**
 * File handling utilities for session save/load
 */

import type { SessionData } from '$lib/types/session';

/**
 * Validate a file before processing
 */
export function validateFile(file: File): string | null {
	// Security: Validate file type
	if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.json')) {
		return 'Invalid file type. Please select a JSON file.';
	}

	// Security: Validate file size (max 1MB)
	const MAX_FILE_SIZE = 1024 * 1024; // 1MB
	if (file.size > MAX_FILE_SIZE) {
		return 'File size exceeds maximum allowed size of 1MB.';
	}

	// Security: Validate file is not empty
	if (file.size === 0) {
		return 'File is empty.';
	}

	return null;
}

/**
 * Parse and validate a JSON file
 */
export async function parseSessionFile(file: File): Promise<{ data: unknown; error: string | null }> {
	const validationError = validateFile(file);
	if (validationError) {
		return { data: null, error: validationError };
	}

	try {
		const fileContent = await file.text();

		// Security: Validate JSON is parseable
		let parsedData: unknown;
		try {
			parsedData = JSON.parse(fileContent);
		} catch (parseError) {
			return { data: null, error: 'Invalid JSON format. Please check the file and try again.' };
		}

		return { data: parsedData, error: null };
	} catch (error) {
		return { data: null, error: 'An error occurred while reading the file. Please try again.' };
	}
}

/**
 * Download session data as a JSON file
 */
export function downloadSessionFile(sessionData: SessionData, filename = 'amortization-session.json'): void {
	const jsonString = JSON.stringify(sessionData, null, 2);
	const blob = new Blob([jsonString], { type: 'application/json' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
