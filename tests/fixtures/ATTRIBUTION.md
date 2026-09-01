# Test fixture attribution

These photographs are used to verify the exported model and to seed the
accuracy harness. Every one is from Wikimedia Commons under a permissive
licence. They are redistributed here under those terms; attribution below.

| Fixture | Expected stream | Licence | Source | Author |
|---|---|---|---|---|
| `banana-peel.jpg` | WET | Public domain | [File:Banane-A-05 cropped.jpg](https://commons.wikimedia.org/wiki/File:Banane-A-05_cropped.jpg) | Priwo |
| `vegetable-waste.jpg` | WET | CC BY-SA 4.0 | [File:Kitchen food waste, vegetable peelings & coffee grounds in biodegradable bag.jpg](https://commons.wikimedia.org/wiki/File:Kitchen_food_waste,_vegetable_peelings_%26_coffee_grounds_in_biodegradable_bag.jpg) | Tek monde |
| `apple-core.jpg` | WET | CC BY 2.0 | [File:Red Apple.jpg](https://commons.wikimedia.org/wiki/File:Red_Apple.jpg) | Abhijit Tembhekar from Mumbai, India |
| `plastic-bottle.jpg` | DRY | CC0 | [File:Empty Plastic Bottle.jpg](https://commons.wikimedia.org/wiki/File:Empty_Plastic_Bottle.jpg) | Echendu Tracy |
| `aluminium-can.jpg` | DRY | CC BY 2.0 | [File:Drinking can ring-pull tab.jpg](https://commons.wikimedia.org/wiki/File:Drinking_can_ring-pull_tab.jpg) | Marcos André |
| `glass-bottle.jpg` | DRY | CC BY 2.0 | [File:Empty green bottles of Gordon’s gin.jpg](https://commons.wikimedia.org/wiki/File:Empty_green_bottles_of_Gordon%E2%80%99s_gin.jpg) | phault |
| `battery.jpg` | HAZARDOUS | CC BY-SA 4.0 | [File:AA VARTA battery-side PNr°0782.jpg](https://commons.wikimedia.org/wiki/File:AA_VARTA_battery-side_PNr%C2%B00782.jpg) | D-Kuru |
| `cardboard-box.jpg` | DRY | CC BY-SA 4.0 | [File:Cardboard box.jpg](https://commons.wikimedia.org/wiki/File:Cardboard_box.jpg) | MrBeastRapper |
| `newspaper.jpg` | DRY | CC BY 2.5 | [File:Newspapers.jpg](https://commons.wikimedia.org/wiki/File:Newspapers.jpg) | Original uploader was Hmbr at he.wikipedia |

Regenerate or extend this set with:

```bash
npm run export:models   # calls scripts/fetch_fixtures.py
```

To evaluate on your own photographs instead — which is what you should do
before trusting any number — see `MODEL_IMPROVEMENT.md` and run:

```bash
npm run eval -- ./my-images
```
