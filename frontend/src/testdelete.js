// A simple tree of numbers
const tree = {
  value: 7,
  children: [
    { value: 3, children: [] },
    {
      value: 2,
      children: [
        { value: 5, children: [] },
        { value: 1, children: [] }
      ]
    }
  ]
};

/*
  Task: Return the total of all node values in the tree.
  The correct result for the tree above is 18.
*/
 
function sumTree(node) {
  if (!node) return 0;
  let total = node.value;
 
  for (const child of node.children) {
    total += ___________ ;   // ← fill in this line
  }
 
  return total;
}
 
console.log(sumTree(tree)); // ➜ 18