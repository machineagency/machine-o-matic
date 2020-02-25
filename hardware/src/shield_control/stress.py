import json

moveJSON0 = { "x1" : 500,  "x2" : 500,  "y"  : 0 }
moveJSON1 = { "x1" : -500, "x2" : -500, "y"  : 0 }
instrJSON = {
   "type" : "moves",
   "data" : { "stepsArray" : [] }
}

max = int(input("range: "))
arr = instrJSON["data"]["stepsArray"]
for x in range(0,max):
   arr.append(moveJSON0)
   arr.append(moveJSON1)
# print(json.dumps(instrJSON, indent=2))

with open("stress.json", "w") as write_file:
   json.dump(instrJSON, write_file, indent=2)