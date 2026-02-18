const commentInput = document.getElementById("commentInput");
const cancelButton = document.getElementById("cancelButton");
const saveButton = document.getElementById("saveButton");

const params = new URLSearchParams(window.location.search);
const requestId = params.get("requestId");

if (!requestId) {
  window.close();
} else {
  async function submit(comment, cancelled = false) {
    await chrome.runtime.sendMessage({
      type: "COMMENT_SUBMIT",
      requestId,
      comment,
      cancelled
    });
    window.close();
  }

  cancelButton.addEventListener("click", () => {
    submit("", true).catch(() => window.close());
  });

  saveButton.addEventListener("click", () => {
    submit(commentInput.value.trim(), false).catch(() => window.close());
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      submit("", true).catch(() => window.close());
    }

    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit(commentInput.value.trim(), false).catch(() => window.close());
    }
  });

  commentInput.focus();
}
