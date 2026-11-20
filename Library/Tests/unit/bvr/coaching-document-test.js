/**
 * CoachingDocument Unit Tests
 *
 * Covers where practice plan links go in the BVR Coaching draft: Create
 * Practice Plan's addLink (including a team with no heading yet), Delete
 * Practice Plan's removeLink, and Clean Up Coaching Document's placeLinks.
 */

require("../Tests/fixtures/assertions.js");
require("modules/bvr/core/CoachingDocument.js");

const test = new TestAssertions("CoachingDocument");

// Shaped like the real draft: a title block, a General section, then one
// section per team, ending in a newline.
const doc = [
  "# BVR Coaching",
  "[[w:BVR]]",
  "",
  "## General",
  "[[bear:MOC: BVR Coaching]]",
  "",
  "## MS Girls Soccer",
  "[[MSGS: Roster 2026]]",
  "[[MS GS Practice Plan: W7]]",
  "",
].join("\n");

// --- addLink ---
test.section("addLink");

test.assertEqual(
  CoachingDocument.addLink(doc, "MS Girls Soccer", "[[MS GS Practice Plan: W8]]"),
  doc.replace("W7]]\n", "W7]]\n[[MS GS Practice Plan: W8]]\n"),
  "goes after the section's last line, keeping the trailing newline",
);
test.assertEqual(
  CoachingDocument.addLink(doc, "MS Girls Basketball", "[[MS GB Practice Plan: W1]]"),
  `${doc}\n## MS Girls Basketball\n[[MS GB Practice Plan: W1]]\n`,
  "a team with no heading gets one at the end, after a blank line",
);
test.assertEqual(
  CoachingDocument.addLink("# BVR Coaching\n\n## General\nx\n\n## Team\nroster\n\n## Other\ny", "Team", "[[P]]"),
  "# BVR Coaching\n\n## General\nx\n\n## Team\nroster\n[[P]]\n\n## Other\ny",
  "a middle section keeps its blank line before the next heading",
);
test.assertEqual(
  CoachingDocument.addLink("## Team\n### Notes\nx\n## Other", "Team", "[[P]]"),
  "## Team\n### Notes\nx\n[[P]]\n## Other",
  "### subheadings stay inside the section",
);
test.assertEqual(
  CoachingDocument.addLink("## Team\n\n## Other", "Team", "[[P]]"),
  "## Team\n[[P]]\n\n## Other",
  "an empty section takes the link right under its heading",
);
test.assertEqual(
  CoachingDocument.addLink("# BVR Coaching", "Team", "[[P]]"),
  "# BVR Coaching\n\n## Team\n[[P]]\n",
  "a draft without a trailing newline gets one",
);

// --- removeLink ---
test.section("removeLink");

test.assertEqual(
  CoachingDocument.removeLink(doc, "[[MS GS Practice Plan: W7]]"),
  doc.replace("[[MS GS Practice Plan: W7]]\n", ""),
  "removes the link's line",
);
test.assertEqual(CoachingDocument.removeLink(doc, "[[Not There]]"), doc, "no match, no change");

// --- placeLinks ---
test.section("placeLinks");

// The bug this fixes: with no MS Girls Basketball heading, Create Practice
// Plan put the link on line 2.
const misplaced = doc.replace("# BVR Coaching\n", "# BVR Coaching\n[[MS GB Practice Plan: W1]]\n");
const basketballW1 = { teamName: "MS Girls Basketball", link: "[[MS GB Practice Plan: W1]]" };

let result = CoachingDocument.placeLinks(misplaced, [basketballW1]);
test.assertEqual(result.content, `${doc}\n## MS Girls Basketball\n[[MS GB Practice Plan: W1]]\n`, "moves the link under a new heading");
test.assertDeepEqual(result.moved, ["[[MS GB Practice Plan: W1]]"], "reports the moved link");
test.assertEqual(CoachingDocument.placeLinks(result.content, [basketballW1]).moved.length, 0, "running it again changes nothing");

result = CoachingDocument.placeLinks(doc, [{ teamName: "MS Girls Soccer", link: "[[MS GS Practice Plan: W7]]" }]);
test.assertEqual(result.content, doc, "a link already in its section stays put");

result = CoachingDocument.placeLinks(doc, [basketballW1]);
test.assertEqual(result.content, doc, "a plan not linked in the draft is not added back");

const duplicated = doc.replace("# BVR Coaching\n", "# BVR Coaching\n[[MS GS Practice Plan: W7]]\n");
result = CoachingDocument.placeLinks(duplicated, [{ teamName: "MS Girls Soccer", link: "[[MS GS Practice Plan: W7]]" }]);
test.assertEqual(result.content, doc, "a stray copy of a link already in its section is removed");

const twoWeeks = misplaced.replace("W1]]\n", "W1]]\n[[MS GB Practice Plan: W2]]\n");
result = CoachingDocument.placeLinks(twoWeeks, [basketballW1, { teamName: "MS Girls Basketball", link: "[[MS GB Practice Plan: W2]]" }]);
test.assertEqual(
  result.content,
  `${doc}\n## MS Girls Basketball\n[[MS GB Practice Plan: W1]]\n[[MS GB Practice Plan: W2]]\n`,
  "several links land in the order given (oldest week first)",
);

const shared = "[[MS GS Practice Plan: W1]]";
const sharedDoc = doc.replace("# BVR Coaching\n", `# BVR Coaching\n${shared}\n`);
result = CoachingDocument.placeLinks(sharedDoc, [
  { teamName: "MS Girls Soccer", link: shared },
  { teamName: "MS Girls Basketball", link: shared },
]);
test.assertEqual(result.content, sharedDoc, "a title two teams' plans share is left alone");
test.assertDeepEqual(result.ambiguous, [shared], "and reported");

test.summary();
