const express = require("express");
// const detailedData = require("../data/GoalDetailsTestData.json");
const app = express();
const router = express.Router();
const { connect, model } = require("mongoose");
const bodyparser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require('jsonwebtoken');
const checkAuth = require("./middleware/check-auth");

const jsonParser = bodyparser.json(); //used for accessing body of the req in post request.
const uri =
  "mongodb+srv://SouravSinha:SouravSinha@atlascluster.hwl00ku.mongodb.net/Ambitions?retryWrites=true&w=majority&appName=AtlasCluster";

connect(uri)
  .then(() => console.log("DB Connected"))
  .catch((error) => console.log("No Connection " + error));

// const schema = new mongoose.Schema({
//   goalTypeId: String,
//   goalType: String,
//   values: String
// });

// User model
const User = model("ambitionsdata", {
  goalTypeId: String,
  goalType: String,
  values: [
    {
      goalId: String,
      cardHeading: String,
      amount: Number,
      totalAmount: Number,
      daystoGo: Number,
      maturityDate: String,
    },
  ],
});

const detailedDataDoc = model("ambitionsdetaileddata", {
  goalId: String,
  cardHeading: String,
  amount: Number,
  totalAmount: Number,
  daystoGo: Number,
  maturityDate: String,
  goalType: String,
  Mutualfunds: [],
  Stocks: [],
});

const credentials = model("credentials", {
  name: String,
  gender: String,
  age: Number,
  phone: String,
  email: String,
  password: String,
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*, authorization");
  res.setHeader("Access-Control-Allow-Methods", "*");
  next();
});

app.post("/login", jsonParser, async (req, res) => {
  const existingUser = await credentials.find({ email: req.body.phoneOrMail });
  let isValidPassword = false;

  if (existingUser.length === 0) {
    res
      .status(200)
      .send({ message: "User not found. Incorrect email or phone!" });
  } else {
    try {
      isValidPassword = await bcrypt.compare(
        req.body.password,
        existingUser[0]?.password
      );
      if (isValidPassword){
        let token;
        try{
          token = await jwt.sign({email: req.body.phoneOrMail, password: req.body.password}, 'secretKey', {expiresIn: '800s'})
          res.status(200).send({email: req.body.phoneOrMail, password: req.body.password, token});
        }
        catch(error){
          console.log(error);
        }
      }
      else 
        res.status(200).send({ message: "Incorrect password !" });
    } 
    catch (error) {
      console.log(error);
    }
  }
});

app.post("/signup", jsonParser, async (req, res) => {
  const hashedpass = await bcrypt.hash(req.body.password, 12);
  const payload = {
    name: req.body.name,
    gender: req.body.gender,
    age: req.body.age,
    phone: req.body.phone,
    email: req.body.email,
    password: hashedpass,
  };
  const credData = await credentials.find();
  console.log(credData);

  let flag = false;
  credData.forEach((element) => {
    if (element.email === payload.email || element.phone === payload.phone) {
      flag = true;
    }
  });
  if (flag) {
    res.status(200).send({ message: "Email or Phone already exits!!" });
  } else {
    const data = new credentials(payload);
    const response = await data.save();
    res.status(200).send(response);
  }
});

app.get("/", (req, res) => {
  res.status(200).send("Server working!");
});


// app.use(checkAuth)        // middleware

app.get("/ambitionsData", checkAuth, async (req, res) => {
  try {
    const resData = await User.find();
    res.status(200).json({ data: resData });
  } catch (error) {
    res.status(400).send("Error occured! " + error);
  }
});

app.get("/getprofile/:id", checkAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const userProfile = await credentials.find({email: id})
    res.status(200).send(userProfile)
  } catch (error) {
    res.status(500).send({message: error})
  }
})

app.post("/addAmbition", jsonParser, checkAuth, async (req, res) => {
  let data = await User.find({ goalType: req.body.goalType });
  data[0]?.values?.push(req.body);
  await User.findOneAndUpdate({ goalType: req.body.goalType }, data[0]);
  const newDetailData = new detailedDataDoc({
    ...req.body,
    Mutualfunds: [],
    Stocks: [],
  });
  await newDetailData.save();
  res.status(200).send(req.body);
});

app.post("/updateAmbition", jsonParser, checkAuth, async (req, res) => {
  const prevGoalType = req.body.prevGoalType;
  const currGoalType = req.body.goalType;

  if (prevGoalType === currGoalType) {
    const resData = await User.find({ goalType: prevGoalType });
    const values = resData && resData[0]?.values;

    values.find((ele) => {
      if (ele.goalId == req.body.goalId) {
        ele.cardHeading = req.body.cardHeading;
        ele.totalAmount = req.body.totalAmount;
        ele.maturityDate = req.body.maturityDate;
        return ele;
      }
    });
    await User.findOneAndUpdate({ goalType: prevGoalType }, { values: values });
  } else {
    const response = await User.find({ goalType: currGoalType });
    const values = response[0]?.values;
    values.push({
      goalId: req.body.goalId,
      goalType: currGoalType,
      cardHeading: req.body.cardHeading,
      amount: req.body.amount,
      totalAmount: req.body.totalAmount,
      daystoGo: req.body.daystoGo,
      maturityDate: req.body.maturityDate,
    });
    await User.findOneAndUpdate({ goalType: currGoalType }, { values: values });

    const resp = await User.find({ goalType: prevGoalType });
    updatedValues = resp[0].values.filter(
      (ele) => ele.goalId !== req.body.goalId
    );
    await User.findOneAndUpdate(
      { goalType: prevGoalType },
      { values: updatedValues }
    );
  }

  //To Update AmbitionDetailedData document.
  await detailedDataDoc.findOneAndUpdate(
    { goalId: req.body.goalId },
    {
      cardHeading: req.body.cardHeading,
      totalAmount: req.body.totalAmount,
      goalType: currGoalType,
      maturityDate: req.body.maturityDate,
    }
  );
  res.status(200).send({ message: "Updated Successfully!" });
});

app.delete("/deleteAmbition", jsonParser, checkAuth, async (req, res) => {
  const data = await User.find();
  let id, resData;
  data.map((ele) => {
    return ele.values.map((val, index) => {
      if (
        val.goalId == req.body.goalId &&
        val.cardHeading == req.body.cardHeading
      ) {
        id = ele._id.toString();
        ele.values.splice(index, 1);
        resData = ele;
      } else {
        return val;
      }
    });
  });
  try {
    await User.findByIdAndUpdate(id, resData);
    await detailedDataDoc.findOneAndDelete({ goalId: req.body.goalId });
    res.status(200).send({ message: "Deleted Successfully!" });
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get("/ambitionsDetailedData", checkAuth, async (req, res) => {
  try {
    const data = await detailedDataDoc.find();
    res.status(200).json({ data: data });
  } catch (error) {
    res.status(400).send("Error occured!" + error);
  }
});

app.get("/insert", async (req, res) => {
  const val = {
    goalId: "304",
    cardHeading: "Mercedes G Wagon",
    amount: 0,
    totalAmount: 70000,
    daystoGo: 38,
    maturityDate: "May 03, 2026",
    goalType: "LifeStyle",
    Mutualfunds: [],
    Stocks: [],
  };
  const data = new detailedDataDoc(val);
  await data.save();
  res.status(200).send({ message: "Inserted Succesfully!" });
});


const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log("Running on port ", port);
});

// app.use("/.netlify/functions/index", router);
// module.exports.handler = serverless(app);
