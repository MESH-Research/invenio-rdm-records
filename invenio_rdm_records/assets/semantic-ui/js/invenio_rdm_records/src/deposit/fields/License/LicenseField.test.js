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

// Formik runs its mount-time validation via a resolved Promise, not a
// timer, so it settles on the microtask queue after render() returns.
// Flush it here with an async act() so it doesn't leak into a later,
// unrelated act() call and trigger a spurious "not wrapped in act" warning.
const renderLicenseField = async (rights = []) => {
  let renderResult;
  await act(async () => {
    renderResult = render(
      <Formik
        initialValues={{ metadata: { rights }, ui: { rights: [] } }}
        onSubmit={() => {}}
      >
        {() => <LicenseField fieldPath="metadata.rights" searchConfig={searchConfig} />}
      </Formik>
    );
  });
  return renderResult;
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
    const { getByText, queryByLabelText } = await renderLicenseField();
    const addCustomButton = getByText("Add custom");

    fireEvent.click(addCustomButton);
    fireEvent.click(getByText("Cancel"));
    await flushFocusRestore();

    expect(queryByLabelText("Title")).not.toBeInTheDocument();
    expect(addCustomButton).toHaveFocus();
  });

  it("returns focus to the trigger when the modal is closed with Escape", async () => {
    const { getByText, queryByLabelText } = await renderLicenseField();
    const addCustomButton = getByText("Add custom");

    fireEvent.click(addCustomButton);
    fireEvent.keyDown(document, { key: "Escape", keyCode: 27, which: 27 });
    await flushFocusRestore();

    expect(queryByLabelText("Title")).not.toBeInTheDocument();
    expect(addCustomButton).toHaveFocus();
  });

  it("returns focus to the trigger after adding a custom license", async () => {
    const { getByText, getByLabelText, queryByLabelText } = await renderLicenseField();
    const addCustomButton = getByText("Add custom");

    fireEvent.click(addCustomButton);
    // Formik's validateOnChange runs asynchronously even without a
    // validate function, so any value-changing event needs an async
    // act() to avoid leaking that validation dispatch outside of it.
    await act(async () => {
      fireEvent.change(getByLabelText("Title"), {
        target: { value: "My Custom License" },
      });
    });
    await act(async () => {
      fireEvent.click(getByText("Add license"));
    });
    await flushFocusRestore();

    expect(queryByLabelText("Title")).not.toBeInTheDocument();
    expect(getByText("My Custom License")).toBeInTheDocument();
    expect(addCustomButton).toHaveFocus();
  });

  it("returns focus to the row's edit button after editing a license", async () => {
    const { getByText, getByLabelText, queryByLabelText } = await renderLicenseField([
      { title: "Original License", description: "A custom license", link: "" },
    ]);
    const editButton = getByText("Edit");

    fireEvent.click(editButton);
    await act(async () => {
      fireEvent.change(getByLabelText("Title"), {
        target: { value: "Renamed License" },
      });
    });
    await act(async () => {
      fireEvent.click(getByText("Change license"));
    });
    await flushFocusRestore();

    expect(queryByLabelText("Title")).not.toBeInTheDocument();
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

  it("reorders licenses when one row is dragged over another", async () => {
    const { container } = await renderLicenseField([
      { title: "First License", description: "", link: "" },
      { title: "Second License", description: "", link: "" },
    ]);

    const titlesInOrder = () =>
      Array.from(container.querySelectorAll(".deposit-drag-listitem .header")).map(
        (node) => node.textContent
      );
    expect(titlesInOrder()).toEqual(["First License", "Second License"]);

    const dragHandles = container.querySelectorAll(".drag-anchor");
    const rows = container.querySelectorAll(".deposit-drag-listitem");
    const dataTransfer = makeDataTransfer();

    fireEvent.dragStart(dragHandles[0], { dataTransfer });
    // The HTML5 backend publishes the drag source in a setTimeout(0);
    // flush it before hovering or the hover handler sees no drag item.
    await act(async () => {
      jest.runAllTimers();
    });
    // useDrop's hover handler calls moveLicense (and thus Formik's move())
    // on dragEnter/dragOver, not on drop, so the value change -- and the
    // resulting async validateOnChange dispatch -- happens here.
    await act(async () => {
      fireEvent.dragEnter(rows[1], { dataTransfer });
      fireEvent.dragOver(rows[1], { dataTransfer });
    });
    fireEvent.drop(rows[0], { dataTransfer });
    fireEvent.dragEnd(dragHandles[0], { dataTransfer });

    expect(titlesInOrder()).toEqual(["Second License", "First License"]);
  });
});
