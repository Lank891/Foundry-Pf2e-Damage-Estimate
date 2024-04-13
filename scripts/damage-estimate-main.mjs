const moduleId = 'pf2e-damage-estimate';
const persistentDamageName = "<i class=\"fa-duotone fa-hourglass icon\">";
const persistentDamageIcon = "fa-hourglass";

const onlyGmSetting = 'onlyGmSetting'
Hooks.on('init', () => {
	game.settings.register(moduleId, onlyGmSetting, {
		name: 'Only GM',
		hint: 'If true, only the GM will see the estimated damage. Otherwise, all players will see it.',
		scope: 'world',
		config: true,
		type: Boolean,
		default: false
	});
	
});

Hooks.on('renderDamageModifierDialog', (dialogInfo, init, data) => {
	if(game.settings.get(moduleId, onlyGmSetting) && !isLoggedUserGamemaster()) {
		return;
	}
		
	const appId = data.appId;
	const dialog = document.querySelector('div#' + appId);
	
	// Since window is too small, we have to make it bigger; its height is in px so we just expand it
	let dialogHeightInPx = parseInt(dialog.style.height);
	dialogHeightInPx += 44;
	dialog.style.height = dialogHeightInPx + "px";
	
	const formulaButton = dialog.querySelector('button.roll');
	
	const damage = getDamage(data);
	const appendString = getEstimateHtmlString(damage);
	
	formulaButton.innerHTML += appendString;
});

const dieRegex = /(\d+)d(\d+)/g;
function getDamage(data) {
	const formula = data.formula;
	const splittedFormula = formula.split('</span>');

	const extractedFormulas = splittedFormula.map((singleFormula) => {
		const endOfFirstTag = singleFormula.indexOf('>');
		const startOfSecondTag = singleFormula.indexOf('<', endOfFirstTag + 1);

		if(endOfFirstTag === -1 || startOfSecondTag === -1)
			return undefined;

		const extractedFormula = singleFormula.substring(endOfFirstTag + 1, startOfSecondTag).trim();
		const minDamageFormula = extractedFormula.replace(dieRegex, "($1)");
		const maxDamageFormula = extractedFormula.replace(dieRegex, "($1 * $2)");
		const isPersistent = singleFormula.includes(persistentDamageIcon);

		return {
			formula: extractedFormula,

			minDamageFormula: minDamageFormula,
			minDamage: calculate(minDamageFormula),

			maxDamageFormula: maxDamageFormula,
			maxDamage: calculate(maxDamageFormula),

			isPersistent: isPersistent
		}
	}).filter(item => item);

	const damageSum = extractedFormulas.reduce((acc, value) => {
		if(value.isPersistent) {
			return {
				min: acc.min,
				max: acc.max,
				persistent: true,
				minPersistent: acc.minPersistent + value.minDamage,
				maxPersistent: acc.maxPersistent + value.maxDamage
			}
		}
		else {
			return {
				min: acc.min + value.minDamage,
				max: acc.max + value.maxDamage,
				persistent: acc.persistent,
				minPersistent: acc.minPersistent,
				maxPersistent: acc.maxPersistent
			}
		}
	}, {
		min: 0,
		max: 0,
		persistent: false,
		minPersistent: 0,
		maxPersistent: 0
	});

	return damageSum;
}

function getEstimateHtmlString(damage) {
	let innerDamageString = ((damage.min+damage.max)/2) + " (" + damage.min + "~" + damage.max + ")";
	if (damage.persistent) {
		innerDamageString += " + " + ((damage.minPersistent + damage.maxPersistent)/2) + " (" + damage.minPersistent + "~" + damage.maxPersistent + ") " + persistentDamageName;
	}

	const hrBeforeSpanString = "<hr style=\"width:80%;opacity:0.5\">"
	const spanString = "<span class=\"damage instance color\">" + innerDamageString + "</span>"
	
	return hrBeforeSpanString + spanString;
}


function calculate(expr) {
	expr = expr.replace(/\s/g, '');
	return calculate_helper(Array.from(expr), 0);
}

function isLoggedUserGamemaster() {
	return !!game.users.get(game.userId).isGM;
}
// Based on https://medium.com/@tommypang04/a-simple-calculator-that-evaluates-elementary-arithmetic-expressions-with-javascript-bca12de61aea
function calculate_helper(s, idx) {
	var stk = [];
	let sign = '+';
	let num = 0;
	
	for (let i = idx; i < s.length; i++) {
	  let c = s[i];
	  if (c >= '0' && c <= '9') {
		num = num * 10 + (c - '0');
	  }
	  if (!(c >= '0' && c <= '9') || i===s.length-1) {
		if (c==='(') {
		  num = calculate_helper(s, i+1);
		  let l = 1, r = 0;
		  for (let j = i+1; j < s.length; j++) {
			if (s[j]===')') {
			  r++;
			  if (r===l) {
				i=j; break;
			  }
			}
			else if (s[j]==='(') l++;
		  }
		}
		let pre = -1;
		switch (sign) {
		  case '+':
			stk.push(num);
			break;
		  case '-':
			stk.push(num*-1);
			break;
		  case '*':
			pre = stk.pop();
			stk.push(pre*num);
			break;
		  case '/':
			pre = stk.pop();
			stk.push(pre/num);
			break;
		}
		sign = c;
		num = 0;
		if (c===')') break;
	  }
	}
	
	let ans = 0;
	
	while (stk.length > 0) {
	  ans += stk.pop();
	}
	
	return ans;
}
