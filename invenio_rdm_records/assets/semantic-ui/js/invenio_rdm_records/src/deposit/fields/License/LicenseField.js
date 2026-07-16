// This file is part of Invenio-RDM-Records
// Copyright (C) 2020-2025 CERN.
// Copyright (C) 2020-2022 Northwestern University.
// Copyright (C) 2021 Graz University of Technology.
//
// Invenio-RDM-Records is free software; you can redistribute it and/or modify it
// under the terms of the MIT License; see LICENSE file for more details.

import _find from "lodash/find";
import React, { Component } from "react";
import PropTypes from "prop-types";
import { getIn, FieldArray } from "formik";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DndProvider } from "react-dnd";
import { FieldLabel, FeedbackLabel } from "react-invenio-forms";
import { Button, Form, Icon, List } from "semantic-ui-react";

import { LicenseModal } from "./LicenseModal";
import { LicenseFieldItem } from "./LicenseFieldItem";
import { i18next } from "@translations/invenio_rdm_records/i18next";

/**
 * The user-facing license.
 *
 */
class VisibleLicense {
  /**
   * Constructor.
   *
   * @param {array} uiRights
   * @param {object} right
   * @param {int} index
   */
  constructor(uiRights, right, index) {
    this.index = index;
    this.type = right.id ? "standard" : "custom";
    this.key = right.id || right.title;
    this.initial = this.type === "custom" ? right : null;

    let uiRight =
      _find(
        uiRights,
        right.id ? (o) => o.id === right.id : (o) => o.title === right.title
      ) || {};

    this.description = uiRight.description_l10n || right.description || "";
    this.title = uiRight.title_l10n || right.title || "";
    this.link =
      (uiRight.props && uiRight.props.url) ||
      uiRight.link ||
      (right.props && right.props.url) ||
      right.link ||
      "";
  }
}

class LicenseFieldForm extends Component {
  // Maintain stable React keys for list items to avoid triggering
  // component re-mounts when one item's license content changes. Formik 
  // has no notion of per-item identity, so we shadow its array operations. 
  itemKeys = [];

  ensureItemKeys = (length) => {
    while (this.itemKeys.length < length) {
      this.itemKeys.push(crypto.randomUUID());
    }
    if (this.itemKeys.length > length) {
      this.itemKeys.length = length;
    }
  };

  moveLicense = (from, to) => {
    const [key] = this.itemKeys.splice(from, 1);
    this.itemKeys.splice(to, 0, key);
    this.props.move(from, to);
  };

  pushLicense = (value) => {
    this.itemKeys.push(crypto.randomUUID());
    this.props.push(value);
  };

  removeLicense = (index) => {
    this.itemKeys.splice(index, 1);
    this.props.remove(index);
  };

  render() {
    const {
      label,
      labelIcon,
      fieldPath,
      uiFieldPath,
      form: { values, errors, initialErrors, initialValues },
      replace: formikArrayReplace,
      required,
      searchConfig,
      serializeLicenses,
    } = this.props;

    const uiRights = getIn(values, uiFieldPath, []);

    const licenseList = getIn(values, fieldPath, []);
    const formikInitialValues = getIn(initialValues, fieldPath, []);

    const error = getIn(errors, fieldPath, null);
    const initialError = getIn(initialErrors, fieldPath, null);
    const licenseError = error || (licenseList === formikInitialValues && initialError);

    let className = "";
    if (licenseError) {
      className = typeof licenseError !== "string" ? licenseError.severity : "error";
    }

    this.ensureItemKeys(licenseList.length);

    return (
      <DndProvider backend={HTML5Backend}>
        <Form.Field required={required} className={className}>
          <FieldLabel htmlFor={fieldPath} icon={labelIcon} label={label} />
          <List>
            {getIn(values, fieldPath, []).map((value, index) => {
              const license = new VisibleLicense(uiRights, value, index);
              return (
                <LicenseFieldItem
                  key={this.itemKeys[index]}
                  license={license}
                  moveLicense={this.moveLicense}
                  replaceLicense={formikArrayReplace}
                  removeLicense={this.removeLicense}
                  searchConfig={searchConfig}
                  serializeLicenses={serializeLicenses}
                />
              );
            })}
          </List>
          <LicenseModal
            searchConfig={searchConfig}
            trigger={
              <Button
                type="button"
                key="standard"
                icon
                labelPosition="left"
                className={className}
              >
                <Icon name="add" />
                {i18next.t("Add standard")}
              </Button>
            }
            onLicenseChange={this.pushLicense}
            mode="standard"
            action="add"
            serializeLicenses={serializeLicenses}
          />
          <LicenseModal
            searchConfig={searchConfig}
            trigger={
              <Button
                type="button"
                key="custom"
                icon
                labelPosition="left"
                className={className}
              >
                <Icon name="add" />
                {i18next.t("Add custom")}
              </Button>
            }
            onLicenseChange={this.pushLicense}
            mode="custom"
            action="add"
          />
          {licenseError && <FeedbackLabel fieldPath={fieldPath} />}
        </Form.Field>
      </DndProvider>
    );
  }
}

LicenseFieldForm.propTypes = {
  label: PropTypes.node.isRequired,
  labelIcon: PropTypes.node,
  fieldPath: PropTypes.string.isRequired,
  uiFieldPath: PropTypes.string,
  form: PropTypes.object.isRequired,
  move: PropTypes.func.isRequired,
  push: PropTypes.func.isRequired,
  remove: PropTypes.func.isRequired,
  replace: PropTypes.func.isRequired,
  required: PropTypes.bool.isRequired,
  searchConfig: PropTypes.object.isRequired,
  serializeLicenses: PropTypes.func,
};

LicenseFieldForm.defaultProps = {
  labelIcon: undefined,
  uiFieldPath: undefined,
  serializeLicenses: undefined,
};

export class LicenseField extends Component {
  render() {
    const { fieldPath } = this.props;
    return (
      <FieldArray name={fieldPath}>
        {(formikProps) => <LicenseFieldForm {...formikProps} {...this.props} />}
      </FieldArray>
    );
  }
}

LicenseField.propTypes = {
  fieldPath: PropTypes.string.isRequired,
  label: PropTypes.string,
  labelIcon: PropTypes.string,
  searchConfig: PropTypes.object.isRequired,
  required: PropTypes.bool,
  serializeLicenses: PropTypes.func,
  uiFieldPath: PropTypes.string,
};

LicenseField.defaultProps = {
  label: i18next.t("Licenses"),
  uiFieldPath: "ui.rights",
  labelIcon: "drivers license",
  required: false,
  serializeLicenses: undefined,
};
