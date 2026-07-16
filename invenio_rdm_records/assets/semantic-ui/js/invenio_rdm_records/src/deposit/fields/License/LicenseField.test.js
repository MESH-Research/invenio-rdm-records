// This file is part of Invenio-RDM-Records
// Copyright (C) 2026 CERN.
//
// Invenio-RDM-Records is free software; you can redistribute it and/or modify it
// under the terms of the MIT License; see LICENSE file for more details.

import { Formik } from "formik";
import React from "react";
import { act } from "react-dom/test-utils";
import { fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

import { LicenseField } from "./LicenseField";

// The jsdom version used by the test runner may not implement
// crypto.randomUUID, which LicenseFieldForm uses for stable item keys.
// Removed in afterAll so the stub doesn't leak into other suites.
let createdCryptoStub = false;
let originalRandomUUID;

beforeAll(() => {
  if (!window.crypto) {
    Object.defineProperty(window, "crypto", { value: {}, configurable: true });
    createdCryptoStub = true;
  }
  originalRandomUUID = window.crypto.randomUUID;
  if (typeof originalRandomUUID !== "function") {
    let uuidCounter = 0;
    window.crypto.randomUUID = () => `test-uuid-${(uuidCounter += 1)}`;
  }
});

afterAll(() => {
  if (createdCryptoStub) {
    delete window.crypto;
  } else if (originalRandomUUID) {
    window.crypto.randomUUID = originalRandomUUID;
  } else {
    delete window.crypto.randomUUID;
  }
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const searchConfig = {
  searchApi: {
    axios: {
      headers: { Accept: "application/vnd.inveniordm.v1+json" },
      url: "/api/vocabularies/licenses",
      withCredentials: false,
    },
  },
  initialQueryState: {
    filters: [["tags", "recommended"]],
  },
};

const renderLicenseField = (rights = []) => {
  return render(
    <Formik
      initialValues={{ metadata: { rights }, ui: { rights: [] } }}
      onSubmit={() => {}}
    >
      {() => <LicenseField fieldPath="metadata.rights" searchConfig={searchConfig} />}
    </Formik>
  );
};

// LicenseModal.closeModal defers the focus restore with setTimeout(0),
// so run the pending timers inside act to flush the state updates.
const flushFocusRestore = async () => {
  await act(async () => {
    jest.runAllTimers();
  });
};

describe("LicenseField modal focus management", () => {
  it("returns focus to the trigger when the modal is cancelled", async () => {
    const { getByText, queryByPlaceholderText } = renderLicenseField();
    const addCustomButton = getByText("Add custom");

    fireEvent.click(addCustomButton);
    fireEvent.click(getByText("Cancel"));
    await flushFocusRestore();

    expect(queryByPlaceholderText("License title")).not.toBeInTheDocument();
    expect(addCustomButton).toHaveFocus();
  });

  it("returns focus to the trigger when the modal is closed with Escape", async () => {
    const { getByText, queryByPlaceholderText } = renderLicenseField();
    const addCustomButton = getByText("Add custom");

    fireEvent.click(addCustomButton);
    fireEvent.keyDown(document, { key: "Escape", keyCode: 27, which: 27 });
    await flushFocusRestore();

    expect(queryByPlaceholderText("License title")).not.toBeInTheDocument();
    expect(addCustomButton).toHaveFocus();
  });

  it("returns focus to the trigger after adding a custom license", async () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } =
      renderLicenseField();
    const addCustomButton = getByText("Add custom");

    fireEvent.click(addCustomButton);
    fireEvent.change(getByPlaceholderText("License title"), {
      target: { value: "My Custom License" },
    });
    await act(async () => {
      fireEvent.click(getByText("Add license"));
    });
    await flushFocusRestore();

    expect(queryByPlaceholderText("License title")).not.toBeInTheDocument();
    expect(getByText("My Custom License")).toBeInTheDocument();
    expect(addCustomButton).toHaveFocus();
  });

  it("returns focus to the row's edit button after editing a license", async () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } =
      renderLicenseField([
        { title: "Original License", description: "A custom license", link: "" },
      ]);
    const editButton = getByText("Edit");

    fireEvent.click(editButton);
    fireEvent.change(getByPlaceholderText("License title"), {
      target: { value: "Renamed License" },
    });
    await act(async () => {
      fireEvent.click(getByText("Change license"));
    });
    await flushFocusRestore();

    expect(queryByPlaceholderText("License title")).not.toBeInTheDocument();
    expect(getByText("Renamed License")).toBeInTheDocument();
    expect(getByText("Edit")).toHaveFocus();
  });
});

// We ensure that key handling hasn't broken the drag and drop reordering.
describe("LicenseField drag and drop reordering", () => {
  // jsdom doesn't implement DragEvent or DataTransfer, so we pass a stub
  // dataTransfer for react-dnd's HTML5 backend to simulate the real drag 
  // event's object that carries payload data, settings, etc.
  const makeDataTransfer = () => ({
    setData: () => {},
    getData: () => "",
    setDragImage: () => {},
    dropEffect: "",
    effectAllowed: "all",
    types: [],
  });

  it("reorders licenses when one row is dragged over another", () => {
    const { container } = renderLicenseField([
      { title: "First License", description: "", link: "" },
      { title: "Second License", description: "", link: "" },
    ]);

    const titlesInOrder = () =>
      Array.from(
        container.querySelectorAll(".deposit-drag-listitem .header")
      ).map((node) => node.textContent);
    expect(titlesInOrder()).toEqual(["First License", "Second License"]);

    const dragHandles = container.querySelectorAll(".drag-anchor");
    const rows = container.querySelectorAll(".deposit-drag-listitem");
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(dragHandles[0], { dataTransfer });
    // The HTML5 backend publishes the drag source in a setTimeout(0);
    // flush it before hovering or the hover handler sees no drag item.
    act(() => {
      jest.runAllTimers();
    });
    fireEvent.dragEnter(rows[1], { dataTransfer });
    fireEvent.dragOver(rows[1], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });
    fireEvent.dragEnd(dragHandles[0], { dataTransfer });

    expect(titlesInOrder()).toEqual(["Second License", "First License"]);
  });
});
