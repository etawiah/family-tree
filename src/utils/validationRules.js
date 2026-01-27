/**
 * Centralized validation rules for all form fields.
 * Each function returns { valid: boolean, error?: string }
 *
 * Philosophy: Only validate what's actually provided.
 * Optional fields should pass if empty, only fail if invalid when provided.
 */

/**
 * Validate required text field
 */
export function validateRequired(value, fieldName = "Field") {
  if (!value || !value.trim()) {
    return { valid: false, error: `${fieldName} is required.` };
  }
  return { valid: true };
}

/**
 * Validate text length
 */
export function validateTextLength(value, minLength = 1, maxLength = 100, fieldName = "Field") {
  const trimmedValue = value?.trim() || "";

  if (trimmedValue.length < minLength && trimmedValue.length > 0) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} character${minLength > 1 ? 's' : ''}.` };
  }

  if (trimmedValue.length > maxLength) {
    return { valid: false, error: `${fieldName} must not exceed ${maxLength} characters.` };
  }

  return { valid: true };
}

/**
 * Validate date format (YYYY-MM-DD)
 * Only validates if a value is provided
 */
export function validateDateFormat(value) {
  if (!value) {
    return { valid: true }; // Optional
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return { valid: false, error: "Date must be in YYYY-MM-DD format (e.g., 1990-05-15)." };
  }

  // Check if it's a valid date
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { valid: false, error: "Invalid date. Please check the date format." };
  }

  return { valid: true };
}

/**
 * Validate date is not in future
 * Only validates if a value is provided
 */
export function validateDateNotInFuture(value, fieldName = "Date") {
  if (!value) {
    return { valid: true }; // Optional
  }

  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Compare dates only, not time

  if (date > today) {
    return { valid: false, error: `${fieldName} cannot be in the future.` };
  }

  return { valid: true };
}

/**
 * Validate death date is after birth date
 * Only validates if both dates are provided
 */
export function validateDeathAfterBirth(deathDate, birthDate) {
  if (!deathDate || !birthDate) {
    return { valid: true }; // Both must be provided to validate
  }

  const death = new Date(deathDate);
  const birth = new Date(birthDate);

  if (death < birth) {
    return { valid: false, error: "Death date must be after birth date." };
  }

  return { valid: true };
}

/**
 * Validate selection field
 */
export function validateSelectRequired(value, fieldName = "Field") {
  if (!value) {
    return { valid: false, error: `Please select a ${fieldName.toLowerCase()}.` };
  }
  return { valid: true };
}

/**
 * Validate number field (positive integer)
 * Only validates if a value is provided
 */
export function validatePositiveInteger(value, fieldName = "Field") {
  if (!value) {
    return { valid: true }; // Optional
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return { valid: false, error: `${fieldName} must be a positive whole number.` };
  }

  return { valid: true };
}

/**
 * PersonForm Field Validators
 */

export function validateFirstName(value) {
  const lengthValidation = validateRequired(value, "First name");
  if (!lengthValidation.valid) return lengthValidation;

  return validateTextLength(value, 1, 100, "First name");
}

export function validateLastName(value) {
  const lengthValidation = validateRequired(value, "Last name");
  if (!lengthValidation.valid) return lengthValidation;

  return validateTextLength(value, 1, 100, "Last name");
}

export function validateMiddleName(value) {
  if (!value) return { valid: true }; // Optional
  return validateTextLength(value, 1, 100, "Middle name");
}

export function validateGender(value) {
  const selectValidation = validateSelectRequired(value, "Gender");
  if (!selectValidation.valid) return selectValidation;

  if (!["male", "female", "other"].includes(value)) {
    return { valid: false, error: "Please select a valid gender." };
  }

  return { valid: true };
}

export function validateTreeSide(value) {
  const selectValidation = validateSelectRequired(value, "Tree side");
  if (!selectValidation.valid) return selectValidation;

  if (!["maternal", "paternal"].includes(value)) {
    return { valid: false, error: "Please select a valid tree side." };
  }

  return { valid: true };
}

export function validateBirthDate(value) {
  if (!value) return { valid: true }; // Optional - no validation needed

  const formatValidation = validateDateFormat(value);
  if (!formatValidation.valid) return formatValidation;

  return validateDateNotInFuture(value, "Birth date");
}

export function validateDeathDate(value, birthDate) {
  if (!value) return { valid: true }; // Optional

  const formatValidation = validateDateFormat(value);
  if (!formatValidation.valid) return formatValidation;

  const futureValidation = validateDateNotInFuture(value, "Death date");
  if (!futureValidation.valid) return futureValidation;

  if (birthDate) {
    return validateDeathAfterBirth(value, birthDate);
  }

  return { valid: true };
}

export function validateCurrentLocation(value) {
  if (!value) return { valid: true }; // Optional
  return validateTextLength(value, 0, 200, "Location");
}

export function validateProfession(value) {
  if (!value) return { valid: true }; // Optional
  return validateTextLength(value, 0, 200, "Profession");
}

export function validatePersonalNotes(value) {
  if (!value) return { valid: true }; // Optional
  return validateTextLength(value, 0, 2000, "Personal notes");
}

export function validateMarriageDate(value) {
  if (!value) return { valid: true }; // Optional unless required by spouse type

  const formatValidation = validateDateFormat(value);
  if (!formatValidation.valid) return formatValidation;

  return validateDateNotInFuture(value, "Marriage date");
}

export function validateRelationshipOrder(value) {
  return validatePositiveInteger(value, "Marriage order");
}

/**
 * RelationshipForm Field Validators
 */

export function validateRelationshipType(value) {
  if (!value) return { valid: true }; // Optional - relationships are optional

  const validTypes = ["parent", "child", "spouse", "ex-spouse", "sibling"];
  if (!validTypes.includes(value)) {
    return { valid: false, error: "Please select a valid relationship type." };
  }

  return { valid: true };
}

export function validateRelatedPerson(value, currentPersonId) {
  if (!value) return { valid: true }; // Optional - relationships are optional

  if (String(value) === String(currentPersonId)) {
    return { valid: false, error: "You cannot relate a person to themselves." };
  }

  return { valid: true };
}

export function validateDivorceDate(value, marriageDate) {
  if (!value) return { valid: true }; // Optional unless required by ex-spouse type

  const formatValidation = validateDateFormat(value);
  if (!formatValidation.valid) return formatValidation;

  const futureValidation = validateDateNotInFuture(value, "Divorce date");
  if (!futureValidation.valid) return futureValidation;

  if (marriageDate) {
    const marriage = new Date(marriageDate);
    const divorce = new Date(value);
    if (divorce < marriage) {
      return { valid: false, error: "Divorce date must be after marriage date." };
    }
  }

  return { valid: true };
}

/**
 * Bulk validation for entire forms
 */

export function validatePersonForm(formState) {
  const errors = {};

  // Required fields only
  const firstNameVal = validateFirstName(formState.first_name);
  if (!firstNameVal.valid) errors.first_name = firstNameVal.error;

  const lastNameVal = validateLastName(formState.last_name);
  if (!lastNameVal.valid) errors.last_name = lastNameVal.error;

  const genderVal = validateGender(formState.gender);
  if (!genderVal.valid) errors.gender = genderVal.error;

  const treeSideVal = validateTreeSide(formState.tree_side);
  if (!treeSideVal.valid) errors.tree_side = treeSideVal.error;

  // Optional fields - only validate if provided
  const middleNameVal = validateMiddleName(formState.middle_name);
  if (!middleNameVal.valid) errors.middle_name = middleNameVal.error;

  const birthDateVal = validateBirthDate(formState.birth_date);
  if (!birthDateVal.valid) errors.birth_date = birthDateVal.error;

  const deathDateVal = validateDeathDate(formState.death_date, formState.birth_date);
  if (!deathDateVal.valid) errors.death_date = deathDateVal.error;

  const locationVal = validateCurrentLocation(formState.current_location);
  if (!locationVal.valid) errors.current_location = locationVal.error;

  const professionVal = validateProfession(formState.profession);
  if (!professionVal.valid) errors.profession = professionVal.error;

  const notesVal = validatePersonalNotes(formState.personal_notes);
  if (!notesVal.valid) errors.personal_notes = notesVal.error;

  return errors;
}

export function validatePersonFormSpouseFields(formState) {
  const errors = {};

  // Marriage date is required for spouse quick-add
  if (!formState.marriage_date) {
    errors.marriage_date = "Marriage date is required.";
  } else {
    const marriageDateVal = validateMarriageDate(formState.marriage_date);
    if (!marriageDateVal.valid) errors.marriage_date = marriageDateVal.error;
  }

  // Relationship order is required for spouse quick-add
  if (!formState.relationship_order || formState.relationship_order < 1) {
    errors.relationship_order = "Marriage order must be 1 or higher.";
  } else {
    const orderVal = validateRelationshipOrder(formState.relationship_order);
    if (!orderVal.valid) errors.relationship_order = orderVal.error;
  }

  return errors;
}

export function validateRelationshipForm(formState, currentPersonId) {
  const errors = {};

  // Both relationship type and related person are optional initially
  // User can add relationships or not - it's up to them

  // Only validate if a relationship type is selected
  if (formState.relationshipType) {
    const typeVal = validateRelationshipType(formState.relationshipType);
    if (!typeVal.valid) errors.relationshipType = typeVal.error;

    // If type is selected, person must be selected
    if (!formState.relatedPersonId) {
      errors.relatedPersonId = "Please select a related person.";
    } else {
      const personVal = validateRelatedPerson(formState.relatedPersonId, currentPersonId);
      if (!personVal.valid) errors.relatedPersonId = personVal.error;
    }

    // Marriage date required for spouse types
    const isSpouseType = formState.relationshipType === "spouse" || formState.relationshipType === "ex-spouse";
    if (isSpouseType) {
      if (!formState.marriageDate) {
        errors.marriageDate = "Marriage date is required.";
      } else {
        const marriageDateVal = validateMarriageDate(formState.marriageDate);
        if (!marriageDateVal.valid) errors.marriageDate = marriageDateVal.error;
      }

      // Divorce date required for ex-spouse
      if (formState.relationshipType === "ex-spouse") {
        if (!formState.divorceDate) {
          errors.divorceDate = "Divorce date is required.";
        } else {
          const divorceDateVal = validateDivorceDate(formState.divorceDate, formState.marriageDate);
          if (!divorceDateVal.valid) errors.divorceDate = divorceDateVal.error;
        }
      }

      // Relationship order required
      if (!formState.relationshipOrder || formState.relationshipOrder < 1) {
        errors.relationshipOrder = "Marriage order must be 1 or higher.";
      } else {
        const orderVal = validateRelationshipOrder(formState.relationshipOrder);
        if (!orderVal.valid) errors.relationshipOrder = orderVal.error;
      }
    }
  }

  return errors;
}
