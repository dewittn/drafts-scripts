# Bold List Items

This script action generates a Regular Expression that bolds the first couple of words in a bulleted or numbered list. For example, this text:

```Markdown
- Bulleted List. This item will get bolded
- This item will not get bolded because it is a complete sentence.
* This item: will get bolded
1. Numbered List. This item will also get bolded
2. Included Symbols: You can specify which symbols in this case ':' will be bolded.
3. Excluded Symbols - You can also specify symbols that will bold text but not be bolded themselves, in this case ' -' triggers the bold formatting but does not change itself.
```

Will be transformed like this:

```Markdown
- **Bulleted List.** This item will get bolded
- This item will not get bolded because it is a complete sentence.
* **This item:** will get bolded
1. **Numbered List.** This item will also get bolded
2. **Included Symbols:** You can specify which symbols in this case ':' will be bolded.
3. **Excluded Symbols** - You can also specify symbols that will bold text but not be bolded themselves, in this case ' -' triggers the bold formatting but does not change itself.
```

You can set which characters or string sets trigger the bolding as well as adjust the max word cut off.

```JavaScript
var settings = {
  bullets: "[-*]",
  numbers: "[\\d]+\\.",
  includedSybmols: ["\\.", ":"],
  excultedSymbols: [" -"," \\^"],
  maxWords: "5",
}
```
