import React, { useState } from "react";
import { X } from "lucide-react";

const AddContactModal = ({ onClose }) => {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errors, setErrors] = useState({});

  const handleClose = () => {
    setName("");
    setPhoneNumber("");
    setErrors({});
    onClose();
  };

  const validatePhoneNumber = (phone) => {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, "");
    // Check if it starts with + and has at least 10 digits
    if (cleaned.startsWith("+")) {
      return cleaned.length >= 11; // + followed by at least 10 digits
    }
    // If no +, should have at least 10 digits
    return cleaned.length >= 10;
  };

  const handleSave = async () => {
    const newErrors = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    // Validate phone number
    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!validatePhoneNumber(phoneNumber)) {
      newErrors.phoneNumber = "Please enter a valid phone number (e.g., +1234567890)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Just close the modal without saving
    handleClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-5"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-slate-800 rounded-xl w-full max-w-md shadow-2xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-100 m-0">Add New Contact</h2>
          <button
            className="w-8 h-8 border-none bg-transparent rounded-md flex items-center justify-center cursor-pointer text-slate-400 transition-all hover:bg-slate-700 hover:text-slate-100"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {errors.general && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          <div className="flex flex-col gap-5">
            {/* Name Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="contact-name"
                className="text-sm font-medium text-slate-100"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                className={`w-full px-4 py-3 border rounded-lg bg-slate-700 text-slate-100 text-sm outline-none transition-all placeholder:text-slate-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.name
                    ? "border-red-500 focus:border-red-500"
                    : "border-slate-600 focus:border-blue-500"
                }`}
                placeholder="Enter contact name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: "" }));
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSave();
                  }
                }}
              />
              {errors.name && <div className="text-xs text-red-500 mt-1">{errors.name}</div>}
            </div>

            {/* Phone Number Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="contact-phone"
                className="text-sm font-medium text-slate-100"
              >
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-phone"
                type="tel"
                className={`w-full px-4 py-3 border rounded-lg bg-slate-700 text-slate-100 text-sm outline-none transition-all placeholder:text-slate-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.1)] disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.phoneNumber
                    ? "border-red-500 focus:border-red-500"
                    : "border-slate-600 focus:border-blue-500"
                }`}
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (errors.phoneNumber) {
                    setErrors((prev) => ({ ...prev, phoneNumber: "" }));
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSave();
                  }
                }}
              />
              {errors.phoneNumber && (
                <div className="text-xs text-red-500 mt-1">{errors.phoneNumber}</div>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Include country code (e.g., +91 for India, +1 for USA)
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-5 border-t border-slate-700">
          <button
            className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2.5 border-none rounded-lg text-sm font-medium cursor-pointer transition-all flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={!name.trim() || !phoneNumber.trim()}
          >
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddContactModal;
