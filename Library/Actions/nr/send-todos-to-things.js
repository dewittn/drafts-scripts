require("modules/nr/ThingsParser.js");

// Sends the draft's open checkboxes ("- [ ] Buy milk #errands") to Things,
// then removes their lines. Morning Pages queues this by name between New from
// selection and DayOne, so it must stay "Send To-do’s to things".
function sendTodosToThings() {
  const checklist = ThingsParser.fromChecklist(draft.content);
  if (checklist.text == draft.content) return;

  const parser = new ThingsParser();
  const items = parser.parse(checklist.todos);
  if (items.length && !parser.send(items)) {
    context.fail("Things did not add the to-dos");
    return;
  }

  // The global draft, since Drafts writes it back when this step ends.
  draft.content = checklist.text;
  draft.update();
}

sendTodosToThings();
