import PropTypes from "prop-types";
import { useEffect, useRef, useState, useCallback } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { BiPlus } from "react-icons/bi";
import Dropdown from "../../../../../../../../components/UI/dropdowns/Dropdown";
import CustomDatePicker from "../../../../../../../../components/UI/CustomDatePicker";
import Textarea from "../../../../../../../../components/UI/Textarea";
import MultiSelectRounded from "../../../../../../../../components/UI/dropdowns/MultiSelectRounded";
import GeneratorInfoHeader from "./components/GeneratorInfoHeader";
import {
	frequencyPrimaryOptions,
	frequencySecondaryOptions,
	generatorStatus,
	SERVICE_STATUS,
	SERVICE_TYPES,
	serviceDurationOptions,
	serviceTypes,
	subWasteType,
	weekdayOptions,
} from "../../../../../../../../utils/constants";
import {
	getAllGeneratorsLocationSnapshot,
	getAllRoutes,
	getAllTreatmentsLocationSnapshot,
	getAllVendorsLocationSnapshot,
	getGeneratorById,
} from "../../../../../../../../utils/firebaseOperations";
import {
	capitalizeFirstLetter,
	dateFormatter,
	daysOfWeek,
	formattedDate,
	getUpcomingDates,
	getUpcomingWeekdays,
	randomizeCoordinates,
	showErrorToastMessage,
	showInternalServerErrorToastMessage,
	showLoadingToastMessage,
	showSuccessToastMessage,
} from "../../../../../../../../utils/helpers";
import {
	arrayUnion,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	limit,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from "firebase/firestore";
import { addOrUpdateGeneratorScheduleReq } from "../../../../../../../../utils/apiOps";
import RouteAssignment from "./components/RouteAssignment";
// import MapWithRoutes from "../../../../../../../../components/maps/MapWithRoutes";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { auth, COLLECTIONS, db } from "../../../../../../../../config/firebase";
import Loader from "../../../../../../../../components/UI/loaders/Loader";
import { MdCheck, MdContentCopy } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Button from "../../../../../../../../components/UI/Button";
import { useAuthState } from "react-firebase-hooks/auth";
import { log } from "handlebars";
import NoOfStops from "./NoOfStops";
import { AzureMapsProvider } from "react-azure-maps";
import useTUserContext from "../../../../../../../../context/TransporterUserContext";
import GeneratorManifests from "./GeneratorManifests";
import { HiOutlineChevronDown, HiOutlineChevronUp } from "react-icons/hi";
import SearchableDropdownForParents from "../../../../../../../../components/UI/dropdowns/SearchableDropdownForParents";
import GeneratorUpcomingServices from "./GeneratorUpcomingServices";
import GeneratorPreviousServices from "./GeneratorPreviousServices";

const defaultOption = {
	serviceType: "",
	routeId: "",
	serviceFrequency: {
		type: "",
		days: [],
	},
	anchorDate: null,
	expectedItemOrService: [],
	serviceDuration: "15",
	notes: "",
	deliveryNotes: "",
	isWillCall: false,
	isSetUpService: false,
	isUpdating: true,
};

const GeneratorRoutes = ({ onClickBack, genId }) => {
	const {
		control,
		handleSubmit,
		formState: { errors },
		watch,
		setValue,
		getValues,
		reset,
		trigger,
	} = useForm({
		defaultValues: {
			serviceSchedules: [defaultOption],
			requestedStartDate: null,
		},
	});
	const {
		control: instructionControl,
		handleSubmit: instructionHandleSubmit,
		setValue: setInstructionsValue,
		watch: watchInstructions,
	} = useForm({
		defaultValues: {
			deliveryNote: "",
			parkingNote: "",
			locationOfWaste: "",
			lockBoxCode: "",
			serviceInstructions: "",
			octoConnectNote: "",
		},
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: "serviceSchedules",
	});
	const navigate = useNavigate();
	const [showSSRFrom, setShowSSRForm] = useState(false);
	const [prevInstructions, setPrevInstructions] = useState({});
	const [serviceTypeOptions, setServiceTypeOptions] = useState([]);
	const [routeOptions, setRouteOptions] = useState([]);
	const [allRoutesOptions, setAllRoutesOptions] = useState([]);
	const [isLoadingServices, setIsLoadingServices] = useState(true);
	const [generatorScheduledServices, setGeneratorScheduledServices] = useState([]);
	const [selectedRouteIds, setSelectedRouteIds] = useState([]);
	const [allRoutes, setAllRoutes] = useState([]);
	const [prevServiceSchedules, setPrevServiceSchedules] = useState([]);
	const [updatedRoutesId, setUpdatedRoutesId] = useState([]);
	const [allGeneratorsData, setAllGeneratorsData] = useState([]);
	const [allTreatmentData, setAllTreatmentData] = useState([]);
	const [allVendorData, setAllVendorData] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [upcomingServices, setUpcomingServices] = useState([]);
	const [previousServices, setPreviousServices] = useState([]);
	const [copied, setCopied] = useState(false);
	const [affectedServices, setAffectedServices] = useState(0);
	const formValues = watch();
	const { user, loading } = useTUserContext();
	const [delay, setDelay] = useState(0);
	const [isGeneratorProfileComplete, setIsGeneratorProfileComplete] = useState(true);
	const [transporterData, setTransporterData] = useState(null);
	const [octoMarketProfile, setOctoMarketProfile] = useState(null);
	const [disableButton, setDisableButton] = useState(false);
	const [itemsOptions, setItemsOptions] = useState([]);
	const [generatorData, setGeneratorData] = useState(null);
	const [itemsMap, setItemsMap] = useState({});
	const [cancelReason, setCancelReason] = useState("");
	const [subContractorData, setSubContractorData] = useState([]);
	const [isOctoMarketUser, setIsOctoMarketUser] = useState(false);
	const [currentServiceSchedules, setCurrentServiceSchedules] = useState([]);
	const [isAutoSaving, setIsAutoSaving] = useState(false);
	const [hasChanges, setHasChanges] = useState(false);
	const [sentSubcontractorRequests, setSentSubcontractorRequests] = useState([]);
	const [currentSSRIndex, setCurrentSSRIndex] = useState(0);
	const [activeSentSSRs, setActiveSentSSRs] = useState([]);
	const [transporterName, setTransporterName] = useState("");
	const [KeepContainers,setKeepContainers] = useState(false)
	const [serviceFrequencyOptions, setServiceFrequencyOptions] = useState([
		...frequencyPrimaryOptions,
		...frequencySecondaryOptions,
	]);
	const fetchTransporter = async (transporterId) => {
		let snapRef = doc(db, COLLECTIONS.transporters, transporterId);
		let snapDoc = await getDoc(snapRef);
		let snapData = { id: snapDoc.id, ...snapDoc.data() };
		console.log({ snapData });
		setTransporterName(snapData?.companyDisplayName ?? snapData?.transporterName);
	};

	const updateGeneratorData = async () => {
		const data = await getGeneratorById(genId);
		setGeneratorData(data);
		setDisableButton(false);
	};

	useEffect(() => {
		if (user?.uid == generatorData?.transporterId && generatorData?.isSubContracted) {
			fetchTransporter(generatorData?.subContractors?.[0]?.id);
		}
	}, [user, generatorData]);

	const instructionsSectionRef = useRef(null);
	const saveInstructions = async () => {
		if (!generatorData || !hasChanges) return;

		try {
			const formData = watchInstructions();
			const hasRealChanges = Object.keys(formData).some((key) => {
				return formData[key] !== prevInstructions[key];
			});

			if (!hasRealChanges) {
				setHasChanges(false);
				return;
			}

			setIsAutoSaving(true);
			await updateDoc(doc(db, COLLECTIONS.generators, generatorData.id), formData);
			setPrevInstructions(formData);
			setHasChanges(false);
			showSuccessToastMessage("Service Instructions saved automatically");
		} catch (error) {
			console.log(error);
			showInternalServerErrorToastMessage();
		} finally {
			setIsAutoSaving(false);
		}
	};
	const serviceType = watch("serviceSchedules.serviceType");

	useEffect(() => {
		if (serviceType) {
			setValue("serviceSchedules.expectedItemOrService", []);
			trigger("serviceSchedules.expectedItemOrService");
		}
	}, [serviceType, setValue, trigger]);

	useEffect(() => {
		const form = instructionsSectionRef.current;
		if (!form) return;

		const handleMouseLeave = () => {
			if (hasChanges) {
				saveInstructions();
			}
		};

		form.addEventListener("mouseleave", handleMouseLeave);

		return () => {
			form.removeEventListener("mouseleave", handleMouseLeave);
		};
	}, [hasChanges, instructionsSectionRef.current]);

	useEffect(() => {
		const formData = watchInstructions();
		const hasRealChanges = Object.keys(formData).some((key) => {
			return formData[key] !== prevInstructions[key];
		});

		setHasChanges(hasRealChanges);
	}, [watchInstructions(), prevInstructions]);

	useEffect(() => {
		if (genId) updateGeneratorData();
	}, [genId]);

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const section = urlParams.get("section");

		if (section) {
			const element = document.getElementById(section);
			if (element) {
				element.scrollIntoView({ behavior: "smooth" });
			}
		}
	}, [allGeneratorsData, isLoadingServices]);
	useEffect(() => {
		if (!generatorData?.id) return;
		let unsubscribe = onSnapshot(
			query(collection(db, COLLECTIONS.serviceSchedules), where("generatorId", "==", generatorData?.id)),
			(snap) => {
				setCurrentServiceSchedules(snap.docs.map((el) => ({ ...el.data(), id: el.id })) ?? []);
			}
		);

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [generatorData]);

	useEffect(() => {
		if (!user) return;
		let unsubscribe = onSnapshot(doc(db, COLLECTIONS.serviceSettings, user.uid), (doc) => {
			if (doc.exists()) {
				const data = doc.data();
				if (data?.serviceFrequencies?.length > 0) {
					const tempFrequencyOptions = [];
					data?.serviceFrequencies?.forEach((item) => {
						const frequency = serviceFrequencyOptions.find((option) => option.value === item);
						if (frequency) {
							tempFrequencyOptions.push(frequency);
						}
					});
					setServiceFrequencyOptions(tempFrequencyOptions);
				}
			}
		});
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);

	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = onSnapshot(doc(db, COLLECTIONS.transporters, user?.uid), (snap) => {
			if (snap.exists()) {
				setTransporterData({ ...snap.data(), id: snap.id });
			}
		});

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);
	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = onSnapshot(doc(db, COLLECTIONS.octoMarketUsers, user?.uid), (snap) => {
			if (snap.exists()) {
				setOctoMarketProfile({ ...snap.data(), id: snap.id });
			}
		});
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);
	// useEffect(() => {
	// 	let unsubscribe = onSnapshot(collection(db,"priceBooks",transporterId,"default", "services", "containers"), (snap) => {
	// 		if (snap.docs.length) {
	// 			let tempOptions = [];
	// 			let tempMap = {};
	// 			snap.docs.forEach((el) => {
	// 				tempOptions.push({
	// 					label: el.data()?.masterItemName ?? "--",
	// 					value: el.id,
	// 					subWasteType: el.data()?.subWasteType,
	// 				});
	// 				tempMap[el.id] = el.data()?.masterItemName ?? "--";
	// 			});
	// 			setItemsOptions(tempOptions);
	// 			setItemsMap(tempMap);
	// 		}
	// 	});
	// 	return () => {
	// 		if (unsubscribe) unsubscribe();
	// 	};
	// }, []);
const [subContractorContainers, setSubContractorContainers] = useState([]);

const fetchContainers = async (transporterId) => {
  if (!transporterId) {
    console.log("No transporter ID provided");
    return [];
  }

  try {
    return new Promise((resolve, reject) => {
      const unsubscribe = onSnapshot(
        collection(db, "priceBooks", transporterId, "default", "services", "containers"),
        (snap) => {
          let tempOptions = [];
          let tempMap = {};
          
          if (snap.docs.length) {
            snap.docs.forEach((el) => {
              tempOptions.push({
                label: el.data()?.masterItemName ?? "--",
                value: el.id,
                subWasteType: el.data()?.subWasteType,
              });
              tempMap[el.id] = el.data()?.masterItemName ?? "--";
            });
            
            setItemsMap(prevMap => ({...prevMap, ...tempMap}));
          } else {
            console.log(`No containers found for transporter: ${transporterId}`);
          }
          unsubscribe();
          resolve(tempOptions);
        },
        (error) => {
          console.error("Error fetching containers:", error);
          unsubscribe();
          reject(error);
        }
      );
    });
  } catch (error) {
    console.error("Error setting up container listener:", error);
    return [];
  }
};

useEffect(() => {
	if (user?.uid) {
	  const loadTransporterContainers = async () => {
		try {
		  const containers = await fetchContainers(user.uid);
		  setItemsOptions(containers);
		} catch (error) {
		  console.error("Failed to load initial containers:", error);
		}
	  };
	  
	  loadTransporterContainers();
	}
  }, [user?.uid]);

const handleSubcontractorSelected = async (subcontractorId) => {
	if (!subcontractorId) {
	  setSubContractorContainers([]);
	  return;
	}
	
	try {
	  const containers = await fetchContainers(subcontractorId);
	  setSubContractorContainers(containers);
	} catch (error) {
	  console.error("Failed to fetch subcontractor containers:", error);
	  setSubContractorContainers([]);
	}
  };

	useEffect(() => {
		if (!generatorData) return;
		setInstructionsValue("deliveryNote", generatorData?.deliveryNote ?? "");
		setInstructionsValue("locationOfWaste", generatorData?.locationOfWaste ?? "");
		setInstructionsValue("lockBoxCode", generatorData?.lockBoxCode ?? "");
		setInstructionsValue("parkingNote", generatorData?.parkingNote ?? "");
		setInstructionsValue("serviceInstructions", generatorData?.serviceInstructions ?? "");
		setInstructionsValue("octoConnectNote", generatorData?.octoConnectNote ?? "");
		setPrevInstructions({
			deliveryNote: generatorData?.deliveryNote ?? "",
			locationOfWaste: generatorData?.locationOfWaste ?? "",
			lockBoxCode: generatorData?.lockBoxCode ?? "",
			parkingNote: generatorData?.parkingNote ?? "",
			serviceInstructions: generatorData?.serviceInstructions ?? "",
			octoConnectNote: generatorData?.octoConnectNote ?? "",
		});
		if (
			!generatorData?.serviceAddCoordinates ||
			!generatorData?.serviceAddCoordinates.lat ||
			!generatorData?.serviceAddCoordinates.lng
		) {
			setIsGeneratorProfileComplete(false);
		}
		const allowedGeneratorStatus = generatorStatus.filter(
			(status) => status.value !== "PROSPECT" && status.value !== "CANCELED" && status.value !== "DEAD_FILE"
		);

		const allowedGeneratorStatusValues = allowedGeneratorStatus.map((status) => status.value);
		if (!allowedGeneratorStatusValues.includes(generatorData?.generatorStatus)) {
			document.getElementById(`generator_not_contracted`).showModal();
		}

		const allowedContractedStatus = generatorStatus.filter(
			(status) => status.value == "CONTRACTED_SCHEDULED" || status.value == "CONTRACTED_UNSCHEDULED"
		);

		const allowedGeneratorContractValues = allowedContractedStatus.map((status) => status.value);
		if (!allowedGeneratorContractValues.includes(generatorData?.generatorStatus)) {
			document.getElementById(`generator_marked_as_NIGO_or_parking`).showModal();
		}
	}, [generatorData]);

	useEffect(() => {
		if (!isGeneratorProfileComplete) {
			document.getElementById(`generator_address_not_found`).showModal();
		}
	}, [isGeneratorProfileComplete]);

	const fetchServiceSchedules = async () => {
		const snap = await getDocs(
			query(
				collection(db, COLLECTIONS.serviceSchedules),
				where("generatorId", "==", generatorData.id),
				where("transporterId", "==", user?.uid)
			)
		);
		const tempSchedules = [];
		snap.docs.forEach(async (el) => {
			if (el.exists()) {
				const data = { ...el.data(), id: el.id };
				if (typeof data.serviceType !== "string") {
					data.serviceType = data.serviceType[0];
				}
				if (!data.hasOwnProperty("isDeleted") || data.isDeleted === false) {
					delete data.upcomingDates;
					tempSchedules.push(data);
				}
			}
		});
		console.log({ tempSchedules });
		tempSchedules.sort((a, b) => {
			let dateA = null;
			let dateB = null;
			if (typeof a?.createdAt?.seconds === "number" || typeof a?.createdAt?.nanoseconds === "number") {
				dateA = new Timestamp(a.createdAt.seconds, a.createdAt.nanoseconds).toDate();
			} else {
				dateA = a.createdAt.toDate();
			}
			if (typeof b?.createdAt?.seconds === "number" || typeof b?.createdAt?.nanoseconds === "number") {
				dateB = new Timestamp(b.createdAt.seconds, b.createdAt.nanoseconds).toDate();
			} else {
				dateB = b.createdAt.toDate();
			}
			return dateA - dateB;
		});
		setValue("serviceSchedules", tempSchedules);
		setPrevServiceSchedules(tempSchedules);
	};
	useEffect(() => {
		if (!generatorData) return;
		fetchServiceSchedules();
	}, [generatorData]);

	useEffect(() => {
		if (!generatorData) return;

		let unsubscribe = onSnapshot(
			query(
				collection(db, COLLECTIONS.scheduledServices),
				where("generatorId", "==", generatorData.id),
				where("status", "!=", SERVICE_STATUS.DELETED),
				orderBy("date", "asc"),
				limit(100)
			),
			async (snap) => {
				try {
					setIsLoadingServices(true);

					let tempServices = [];
					const jobs = snap.docs.map(async (el) => {
						if (el.exists()) {
							const data = { ...el.data(), id: el.id };
							if (data?.routeId?.length > 0) {
								const routeRes = await getDoc(doc(db, COLLECTIONS.routes, data.routeId));
								if (routeRes.exists()) {
									data.routeData = { ...routeRes.data(), id: routeRes.id };
								}
							}
							if (data?.serviceScheduleId?.length > 0) {
								const serviceScheduleRes = await getDoc(doc(db, COLLECTIONS.serviceSchedules, data.serviceScheduleId));
								if (serviceScheduleRes.exists()) {
									data.serviceScheduleData = { ...serviceScheduleRes.data(), id: serviceScheduleRes.id };
								}
							}
							tempServices.push(data);
						}
					});
					await Promise.all(jobs);

					console.log({ tempServices });
					const today = new Date();
					const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
					setUpcomingServices(
						tempServices
							.filter((el) => {
								if (
									el.date.toDate() >= todayUTC &&
									el.status !== SERVICE_STATUS.COMPLETE &&
									el.status !== SERVICE_STATUS.CLOSED
								) {
									return true;
								} else {
									return false;
								}
							})
							.sort((a, b) => a.date.toDate() - b.date.toDate())
					);
					setPreviousServices([
						...tempServices
							.filter(
								(el) =>
									el.date.toDate() < todayUTC ||
									el.status === SERVICE_STATUS.COMPLETE ||
									el.status === SERVICE_STATUS.CLOSED
							)
							.sort((a, b) => b.date.toDate() - a.date.toDate()),
					]);

					setGeneratorScheduledServices(tempServices);
					setIsLoadingServices(false);
				} catch (error) {
					console.log(error);
				}
			}
		);

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [generatorData]);

	useEffect(() => {
		const getAllOtherRoutes = async () => {
			const snap = await getDocs(query(collection(db, COLLECTIONS.routes), where("transporterId", "==", user?.uid)));
			setAllRoutes([...snap.docs.map((el) => ({ ...el.data(), id: el.id }))]);
		};
		if (user && user?.uid) getAllOtherRoutes();
	}, [user]);

	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = onSnapshot(
			query(collection(db, COLLECTIONS.generators), where("transporterId", "==", user?.uid)),
			(snap) => {
				const tempGeneratorData = [];
				snap.docs.forEach((generator) => {
					if (
						generator.exists() &&
						generator.data().serviceAddCoordinates &&
						generator.data().serviceAddCoordinates.lat &&
						generator.data().serviceAddCoordinates.lng
					) {
						tempGeneratorData.push({
							...generator.data(),
							id: generator.id,
							randomCoordinates: randomizeCoordinates(
								generator.data().serviceAddCoordinates.lat,
								generator.data().serviceAddCoordinates.lng
							),
						});
					}
				});
				setAllGeneratorsData(tempGeneratorData);
			}
		);
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);
	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = getAllTreatmentsLocationSnapshot(setAllTreatmentData, user?.uid);
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);
	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = getAllVendorsLocationSnapshot(setAllVendorData, user?.uid);
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);

	const watchServiceSchedules = watch("serviceSchedules");

	useEffect(() => {
		const fetchAllRoutesOptions = async () => {
			try {
				let resp = await getAllRoutes(user?.uid);
				console.log({ resp });

				const allActiveRoutes = resp.filter((route) => route.status === "ACTIVE");
				const allOtherRoutes = resp.filter((route) => route.status !== "ACTIVE");

				setAllRoutesOptions(resp);
				let options = [];
				options.push({ label: "Available Routes", value: null, isDisabled: true });
				allActiveRoutes.forEach((item) => {
					options.push({
						label: item.routeLabel,
						value: item.id,
					});
				});
				options.push({ label: "Out of Service Network", value: null, isDisabled: true });
				allOtherRoutes.forEach((item) => {
					options.push({
						label: item.routeLabel,
						value: item.id,
					});
				});

				setRouteOptions(options);
			} catch (error) {
				console.log("Error fetching routes", error);
			}
		};
		if (user) fetchAllRoutesOptions();
	}, [user]);

	useEffect(() => {
		if (generatorData?.serviceType) {
			setServiceTypeOptions(serviceTypes.filter((item) => generatorData?.serviceType.includes(item.value)));
		}
	}, [generatorData]);

	useEffect(() => {
		if (watchServiceSchedules) {
			watchServiceSchedules.forEach((schedule, index) => {
				const calculatedDates = calculateUpcomingDates(schedule);
				setValue(`serviceSchedules.${index}.upcomingDates`, calculatedDates, { shouldValidate: true });
			});
		}
	}, [watchServiceSchedules, setValue]);
	useEffect(() => {
		const subscription = watch((value, { name }) => {
			if (
				name &&
				name.startsWith("serviceSchedules") &&
				(name.endsWith("anchorDate") || name.includes("serviceFrequency"))
			) {
				const index = parseInt(name.split(".")[1]);
				const schedule = value.serviceSchedules[index];

				if (schedule && schedule?.anchorDate && schedule?.serviceFrequency && schedule?.routeId) {
					console.log("Calculating dates for schedule:", schedule);
					let calculatedDates = [];
					if (schedule.serviceFrequency.type === "WC") {
						calculatedDates = [];
					} else if (schedule.serviceFrequency.type === "MTWM") {
						if (schedule.serviceFrequency.days.length > 0) {
							const anchorDate = new Date(schedule.anchorDate);
							const anchorDateUTC = new Date(
								Date.UTC(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())
							);

							calculatedDates = getUpcomingWeekdays(anchorDateUTC, schedule.serviceFrequency.days, 6);
						}
					} else {
						calculatedDates = getUpcomingDates(new Date(schedule.anchorDate), schedule.serviceFrequency.type, 6);
					}
					let dates = calculatedDates;
					setValue(`serviceSchedules.${index}.upcomingDates`, dates);
				}
			}
		});

		return () => subscription.unsubscribe();
	}, [watch, setValue]);

	const groupContainersBySubWasteType = (containers) => {
		const groupedContainers = {};

		containers.forEach((container) => {
			const subWasteType = container.subWasteType;
			if (!groupedContainers[subWasteType]) {
				groupedContainers[subWasteType] = [];
			}
			groupedContainers[subWasteType].push(container);
		});

		// Then create a new array with headers and options
		const result = [];

		Object.keys(groupedContainers)
			.sort()
			.forEach((subWasteType) => {
				// Add a header for this subWasteType group
				result.push({
					label: `${subWasteType}`,
					value: subWasteType,
					isDisabled: true,
					isHeader: true,
				});

				// Add all containers for this group
				groupedContainers[subWasteType].forEach((container) => {
					result.push({
						label: container.label,
						value: container.value,
					});
				});
			});

		return result;
	};

	function formatUtcDateString(utcDateString) {
		const date = new Date(utcDateString);
		const formatter = new Intl.DateTimeFormat("en-US", {
			weekday: "short",
			month: "2-digit",
			day: "2-digit",
			year: "numeric",
			timeZone: "UTC",
		});

		return formatter.format(date);
	}

	function formatDateString(utcDateString, timeZone = "America/Los_Angeles") {
		const date = new Date(utcDateString);
		const formatter = new Intl.DateTimeFormat("en-US", {
			weekday: "short",
			month: "2-digit",
			day: "2-digit",
			year: "numeric",
			timeZone,
		});

		return formatter.format(date);
	}
	function formatTimeString(dateString, timeZone = "America/Los_Angeles") {
		const date = new Date(dateString);

		const formatter = new Intl.DateTimeFormat("en-US", {
			hour12: true,
			hour: "2-digit",
			minute: "2-digit",
			timeZone,
		});

		return formatter.format(date);
	}

	const addSetUpService = () => {
		append({
			...defaultOption,
			isSetUpService: true,
		});
	};

	const handleSave = async (index) => {
		try {
			setIsSubmitting(true);
			const data = {
				...formValues.serviceSchedules[index],
				generatorId: generatorData.id,
				transporterId: user?.uid,
				createdAt: serverTimestamp(),
			};
			console.log("Data to save:", data);
			delete data?.isUpdating;
			delete data?.isSetUpService;
			delete data?.upcomingDates;
			showLoadingToastMessage("Saving...");
			let scheduleRef = null;
			if (data?.id) {
				scheduleRef = doc(db, COLLECTIONS.serviceSchedules, data.id);
			} else {
				scheduleRef = doc(collection(db, COLLECTIONS.serviceSchedules));
			}

			const batch = writeBatch(db);
			batch.set(scheduleRef, data);
			if (!data?.id) {
				batch.update(doc(db, COLLECTIONS.generators, generatorData.id), {
					serviceSchedules: arrayUnion(scheduleRef.id),
					updatedAt: serverTimestamp(),
				});
			}
			await batch.commit();
			showSuccessToastMessage("Service created successfully!. Changes will reflect shortly.");
			updateGeneratorData();
			fetchServiceSchedules();
		} catch (error) {
			if (error.cause === "customError") {
				showErrorToastMessage(error.message);
			} else {
				toast.dismiss();
				console.error("Error saving schedules:", error);
				toast.error("Error saving schedules. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const deleteSchedule = async (field, index) => {
		console.log({ field });
		showLoadingToastMessage("Deleting");
		let allSchedules = getValues("serviceSchedules");

		let dataToDelete = allSchedules.find((_, i) => index == i);
		console.log({ dataToDelete });

		let theData = {
			...field,
			id: dataToDelete.id,
		};

		if (theData.id) {
			try {
				const serviceRes = await getDocs(
					query(
						collection(db, COLLECTIONS.scheduledServices),
						where("generatorId", "==", generatorData.id),
						where("serviceScheduleId", "==", formValues.serviceSchedules[index].id),
						where("status", "==", SERVICE_STATUS.PENDING)
					)
				);
				let batch = writeBatch(db);
				let count = 0;
				for (const el of serviceRes.docs) {
					batch.delete(el.ref);
					count++;
					if (count >= 450) {
						await batch.commit();
						count = 0;
						batch = writeBatch(db);
					}
				}
				batch.update(doc(db, COLLECTIONS.serviceSchedules, theData.id), { isDeleted: true });
				await batch.commit();
				showSuccessToastMessage("Deleted successfully!");
				updateGeneratorData();
				fetchServiceSchedules();
			} catch (error) {
				console.error("Failed to delete schedule:", error);
			}
		} else {
			showSuccessToastMessage("Deleted successfully!");
			remove(index);
		}
	};

	const instructionSubmitHandler = async (data) => {
		if (!generatorData) return;

		try {
			showLoadingToastMessage("Saving Service Instructions.");
			await updateDoc(doc(db, COLLECTIONS.generators, generatorData.id), data);
			setPrevInstructions(data);
			showSuccessToastMessage("Service Instructions saved successfully.");
		} catch (error) {
			console.log(error);
			showInternalServerErrorToastMessage();
		}
	};

	const fetchSentSubcontractorRequests = useCallback(async () => {
		if (!user?.uid || !generatorData?.id) return;

		try {
			const currentTransporterRef = doc(db, COLLECTIONS.transporters, user.uid);
			const transporterDoc = await getDoc(currentTransporterRef);

			if (transporterDoc.exists()) {
				const transporterData = transporterDoc.data();
				const sentRequests = transporterData.sharedGenerators?.fromMe || [];
				const filteredSentRequests = sentRequests
					.filter((req) => req.genId === generatorData.id)
					.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
				const receivedRequests = transporterData.sharedGenerators?.toMe || [];
				const filteredReceivedRequests = receivedRequests
					.filter((req) => req.genId === generatorData.id && req.status === SERVICE_STATUS.ACCEPTED)
					.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
				setSentSubcontractorRequests(filteredSentRequests);
				const activeSent = filteredSentRequests.filter((req) => req.status !== SERVICE_STATUS.CANCELLED);
				const combinedRequests = [...activeSent, ...filteredReceivedRequests];
				setActiveSentSSRs(combinedRequests);
			}
		} catch (error) {
			console.error("Error fetching subcontractor requests:", error);
		}
	}, [user, generatorData]);

	useEffect(() => {
		if (user?.uid && generatorData?.id) {
			fetchSentSubcontractorRequests();
		}
	}, [user?.uid, generatorData?.id, fetchSentSubcontractorRequests]);

	const handleCopyToClipboard = async () => {
		try {
			let dates = upcomingServices.map((scheduledService) => formattedDate(scheduledService.date));
			await navigator.clipboard.writeText(dates?.join("; "));
			setCopied(true);
			setTimeout(() => {
				setCopied(false);
			}, 1000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};
	// 	const formRef = useRef(null);

	// useEffect(() => {
	//   const handleClickOutside = (event) => {
	//     if (formRef.current && !formRef.current.contains(event.target)) {
	//       setShowSSRForm(false);
	//     }
	//   };

	//   if (showSSRFrom) {
	//     document.addEventListener("mousedown", handleClickOutside);
	//   }

	//   return () => {
	//     document.removeEventListener("mousedown", handleClickOutside);
	//   };
	// }, [showSSRFrom]);

	const renderSSRButton = () => {
		let isDisable = false;
		// if (cotoMarketProfile && cotoMarketProfile?.connections && Object.keys(cotoMarketProfile?.connections).length) {
		// 	Object.keys(cotoMarketProfile?.connections).forEach((key) => {
		// 		if (cotoMarketProfile?.connections[key].status === "accepted") {
		// 			isDisable = false;
		// 		}
		// 	});
		// }
		return (
			<button
				type="button"
				className={`text-cardTextGray border-borderCol flex items-center justify-between gap-1 min-w-40 px-8 py-3 rounded-full ${
					isDisable
						? "bg-dashBtnGradient brightness-75 text-gray-200"
						: "bg-dashBtnGradient text-white hover:opacity-90"
				} border transition-colors duration-200 ease-in-out`}
				onClick={() => {
					setShowSSRForm(!showSSRFrom);
					if (!isOctoMarketUser) {
						document.getElementById(`transporter_not_octomarket_user`).showModal();
					}

					if (isDisable) {
						showErrorToastMessage("You don't have any active connection to create SSR");
						return;
					}
				}}
			>
				<span className="pr-5">Subcontractor Service Request (SSR)</span>
				<BiPlus size={16} />
			</button>
		);
	};
	const renderAddMoreServiceButtons = () => {
		return (
			<div className="text-sm flex gap-5 items-center">
				<button
					type="button"
					className={`text-cardTextGray border-borderCol flex items-center justify-between gap-1 min-w-40 px-8 py-3 rounded-full bg-creamWhite hover:bg-cardTextGray hover:bg-opacity-10 border transition-colors duration-200 ease-in-out`}
					onClick={addSetUpService}
				>
					<span className="pr-5">Add a Service</span>
					<BiPlus size={16} />
				</button>
			</div>
		);
	};
	// const isSubcontractorSelected = () => {
	// 	const selectedSubcontractor = getValues("selectedSubContractor");
	// 	return selectedSubcontractor !== null && selectedSubcontractor !== undefined;
	//   };

	const renderSSRForm = (isReadOnly, ssrData) => {
		console.log("ssr data", ssrData);
		const getFormData = () => {
			console.log("ssr data", ssrData);

			if (isReadOnly && ssrData) {
				const isReceived = ssrData.subcontractorId === user?.uid;
				return {
					selectedSubContractor: {
						id: isReceived ? user?.uid : ssrData.subcontractorId,
						Cname: isReceived ? transporterData?.companyName : ssrData.subContractorName,
					},
					serviceFrequency: {
						type: ssrData.serviceFrequency,
						days: ssrData.weekdays || [],
					},
					requestedStartDate: ssrData.requestedStartDate || "N/A",
					serviceType: ssrData.serviceType,
					serviceDuration: ssrData.serviceDuration,
					expectedItemOrService: ssrData.expectedItemsOrServices || [],
					serviceNote: ssrData.serviceNote || "",
					isReceivedSSR: isReceived,
				};
			} else {
				return {
					selectedSubContractor: getValues("selectedSubContractor") || "N/A",
					serviceFrequency: {
						type: getValues("serviceSchedules.serviceFrequency.type") || "",
						days: getValues("serviceSchedules.serviceFrequency.days") || [],
					},
					requestedStartDate: getValues("requestedStartDate"),
					serviceType: getValues("serviceSchedules.serviceType") || "",
					serviceDuration: getValues("serviceSchedules.serviceDuration") || "15",
					expectedItemOrService: getValues("serviceSchedules.expectedItemOrService") || [],
					serviceNote: getValues("serviceNote") || "",
				};
			}
		};

		const formData = getFormData();

		// received SSR
		if (formData.isReceivedSSR) {
			const getServiceFrequencyLabel = (value) => {
				const option = serviceFrequencyOptions.find((opt) => opt.value === value);
				return option ? option.label : value;
			};

			const getServiceTypeLabel = (value) => {
				const option = serviceTypes.find((opt) => opt.value === value);
				return option ? (option.value === "HAZARDOUS_WASTE" ? "Hazardous Waste" : option.label) : value;
			};

			const getServiceDurationLabel = (value) => {
				const option = serviceDurationOptions.find((opt) => opt.value === value);
				return option ? option.label : value;
			};
			console.log("rcived ssr", formData, ssrData);

			return (
				<div className="pb-4">
					<div
						className="border-4 p-6 border-[transparent]"
						style={{ borderImage: "linear-gradient(135deg, #007AFF 0%, #4CD964 100%) 1" }}
					>
						<div className="grid grid-cols-2 gap-6">
							<div className="space-y-4">
								<div className="flex gap-2">
									<div className="text-md mb-1">Contractor : </div>
									<div className="font-medium">{ssrData.transporterName || "N/A"}</div>
								</div>

								<div className="flex gap-2">
									<div className="text-md mb-1">Service Frequency : </div>
									<div className="font-medium">{getServiceFrequencyLabel(formData.serviceFrequency.type)}</div>
								</div>

								{formData.serviceFrequency.type === "MTWM" && (
									<div className="flex gap-2">
										<div className="text-md mb-1">Selected Weekdays :</div>
										<div className="font-medium">
											{formData.serviceFrequency.days && formData.serviceFrequency.days.length > 0
												? formData.serviceFrequency.days
														.map((day) => {
															const dayOption = weekdayOptions.find((opt) => opt.value === day);
															return dayOption ? dayOption.label : day;
														})
														.join(", ")
												: "No weekdays selected"}
										</div>
									</div>
								)}

								<div className="flex gap-2">
									<div className="text-md mb-1">Requested Start Date :</div>
									<div className="font-medium">
										{formData.requestedStartDate ? dateFormatter(formData.requestedStartDate) : "Not specified"}
									</div>
								</div>
								<div className="flex gap-2">
									<div className="text-md mb-1">Service Duration :</div>
									<div className="font-medium">{getServiceDurationLabel(formData.serviceDuration)}</div>
								</div>
							</div>

							<div className="space-y-4">
								<div className="flex gap-2">
									<div className="text-md mb-1">Service Type :</div>
									<div className="font-medium">{getServiceTypeLabel(formData.serviceType)}</div>
								</div>

								<div className="flex gap-2">
									<div className="text-md mb-1">Expected Containers :</div>
									{formData.expectedItemOrService && formData.expectedItemOrService.length > 0 ? (
										<div>
											{formData.expectedItemOrService.map((itemObj, index) => (
												<div key={index} className="flex justify-between items-center">
													<span className="text-md">{itemsMap?.[itemObj.item] || itemObj.item}</span>
													<span className="font-medium">Qty: {itemObj.quantity || 1}</span>
												</div>
											))}
										</div>
									) : (
										<div className="text-gray-500">No containers specified</div>
									)}
								</div>
								<div className="flex gap-2">
									<div className="text-md mb-1">Service Note :</div>
									<div className="font-medium whitespace-pre-wrap">{formData.serviceNote || "N/A"}</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			);
		}
		{
			console.log("subconytractorData", subContractorData);
		}
		const selectedSubcontractor = getValues("selectedSubContractor");

		const hasSubcontractorSelected = isReadOnly || selectedSubcontractor;
		const getDropdownOptions = () => {
			return subContractorData
				?.filter((subContractor) => subContractor.contractorName || subContractor.name)
				.map((subContractor) => ({
					label: `${subContractor.transporterOctoId} , ${subContractor.contractorName || subContractor.name || "--"}`,
					value: JSON.stringify({
						id: subContractor.contractorDocid || subContractor.id,
						Cname: subContractor.contractorName || subContractor.name || "--",
					}),
				}));
		};

		return (
			<div className="pb-4">
				<div className="flex gap-8 w-full">
					<div className="w-1/2 space-y-4">
						<div className="w-full relative">
							<SearchableDropdownForParents
								label={"Subcontractor"}
								options={getDropdownOptions()}
								value={formData.selectedSubContractor ? JSON.stringify(formData.selectedSubContractor) : ""}
								onChange={(selectedValue) => {
									if (!isReadOnly) {
									  const selectedSubcontractor = JSON.parse(selectedValue);
									  setValue("selectedSubContractor", selectedSubcontractor);
									  trigger("selectedSubContractor");
									  setValue("serviceSchedules.expectedItemOrService", []);
									  handleSubcontractorSelected(selectedSubcontractor.id);
									}
								  }}
								isRequired
								listHeight="max-h-64"
								isDisabled={isReadOnly || formData.isReceivedSSR}
							/>
							{!isReadOnly && errors.selectedSubContractor && (
								<p className="text-red-500 text-sm mt-1">{errors.selectedSubContractor.message}</p>
							)}
						</div>

						<Dropdown
							label="Service Frequency"
							options={serviceFrequencyOptions}
							value={formData.serviceFrequency.type}
							onChange={(e) => {
								if (!isReadOnly) {
									setValue("serviceSchedules.serviceFrequency.type", e);
									trigger("serviceSchedules.serviceFrequency.type");
								}
							}}
							isRequired
							listHeight="max-h-64"
							isDisabled={isReadOnly||!hasSubcontractorSelected}
						/>
						{!isReadOnly && errors.serviceSchedules?.serviceFrequency?.type && (
							<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules.serviceFrequency.type.message}</p>
						)}
						{formData.serviceFrequency.type === "MTWM" && (
							<div className="w-full mt-2">
								<div className="w-full flex">
									<p className="w-1/3 whitespace-nowrap truncate text-cardTextGray">
										{isReadOnly ? "Selected Weekdays:" : "Select Weekdays *"}
									</p>
									<div className="w-2/3">
										{isReadOnly ? (
											<div className="bg-gray-100 p-2 rounded-full px-4 text-cardTextGray">
												{formData.serviceFrequency.days && formData.serviceFrequency.days.length > 0
													? formData.serviceFrequency.days
															.map((day) => {
																const dayOption = weekdayOptions.find((opt) => opt.value === day);
																return dayOption ? dayOption.label : day;
															})
															.join(", ")
													: "No weekdays selected"}
											</div>
										) : (
											<MultiSelectRounded
												value={formData.serviceFrequency.days}
												onChange={(selectedDays) => {
													setValue("serviceSchedules.serviceFrequency.days", selectedDays);
													trigger("serviceSchedules.serviceFrequency.days");
												}}
												options={weekdayOptions}
												id={`ssr-weekdays-input`}
												styles="flex flex-col w-full gap-1"
												margin="0"
												isDisabled={isReadOnly||!hasSubcontractorSelected}
											/>
										)}
									</div>
								</div>
								{!isReadOnly && errors.serviceSchedules?.serviceFrequency?.days && (
									<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules.serviceFrequency.days.message}</p>
								)}
							</div>
						)}

						<div className="flex items-center justify-between my-4">
							<label htmlFor="requestedStartDate" className="truncate text-inputLabel font-normal">
								Requested Start Date {!isReadOnly && "*"}
							</label>
							<div className="w-2/3">
								{isReadOnly ? (
									<div className="bg-gray-100 p-2 rounded-full px-4 text-cardTextGray">
										{formData.requestedStartDate ? dateFormatter(formData.requestedStartDate) : "Not specified"}
									</div>
								) : (
									<CustomDatePicker
										selectedDate={formData.requestedStartDate}
										setSelectedDate={(value) => {
											setValue("requestedStartDate", value);
											trigger("requestedStartDate");
										}}
										label={"Requested Start Date *"}
										startYear={new Date().getFullYear()}
										endYear={new Date().getFullYear() + 5}
										yearReversed={true}
										minDate={new Date()}
										isDisabled={isReadOnly||!hasSubcontractorSelected}
									/>
								)}
							</div>
						</div>
						{!isReadOnly && errors.requestedStartDate && (
							<p className="text-red-500 text-sm mt-1">{errors.requestedStartDate.message}</p>
						)}
						<Textarea
							value={formData.serviceNote}
							onChange={(e) => {
								if (!isReadOnly) {
									setValue("serviceNote", e.target.value);
								}
							}}
							label="Service Note To Subcontractor"
							isDisabled={isReadOnly}
						/>
					</div>

					<div className="w-1/2 space-y-4">
					<Dropdown
  label="Service Type"
  options={serviceTypes.map((item) => ({
    label: item.value === "HAZARDOUS_WASTE" ? "Hazardous Waste" : item.label,
    value: item.value === "HAZARDOUS_WASTE" ? null : item.value,
    isDisabled: item.value === "HAZARDOUS_WASTE",
  }))}
  disabledBgColor="white"
  disabledTextColor="gray-300"
  value={formData.serviceType}
  onChange={(e) => {
    if (!isReadOnly) {
      const prevValue = formData.serviceType;
      console.log("Service type changed from", prevValue, "to", e);
      
      // First update the service type value
      setValue("serviceSchedules.serviceType", e);
      trigger("serviceSchedules.serviceType");
      
      // Use the EXACT same condition as in the working component
      if (
        (
          (e === SERVICE_TYPES.PAPER_SHREDDING && prevValue === SERVICE_TYPES.PAPER_SHREDDING) ||
          (e === SERVICE_TYPES.PAPER_SHREDDING && prevValue === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING) ||
          (e === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING && prevValue === SERVICE_TYPES.PAPER_SHREDDING) ||
          (e === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING && prevValue === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING)
        )
      ) {
       setKeepContainers(true)
      }
    }
  }}
  isRequired
  isDisabled={isReadOnly || !hasSubcontractorSelected}
/>
						{!isReadOnly && errors.serviceSchedules?.serviceType && (
							<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules.serviceType.message}</p>
						)}

						<Dropdown
							label="Service Duration"
							options={serviceDurationOptions}
							value={formData.serviceDuration}
							onChange={(e) => {
								if (!isReadOnly) {
									setValue("serviceSchedules.serviceDuration", e);
									trigger("serviceSchedules.serviceDuration");
								}
							}}
							isRequired
							isDisabled={isReadOnly||!hasSubcontractorSelected}
						/>
						{!isReadOnly && errors.serviceSchedules?.serviceDuration && (
							<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules.serviceDuration.message}</p>
						)}

<div className="w-full flex flex-col gap-4">
  <div className="w-full flex">
    <p className="w-1/3 whitespace-nowrap truncate text-inputLabel font-normal">
      Expected Container(s) *
    </p>
    <div className="w-2/3">
      <MultiSelectRounded
        isDisabled={isReadOnly || (!isReadOnly && !formValues.serviceSchedules?.serviceType) || !hasSubcontractorSelected}
        value={formData.expectedItemOrService.map((v) => v.item)}
        onChange={(selectedItems) => {
          if (!isReadOnly) {
            const transformedItems = selectedItems.map((item) => {
              const existingItem = formData.expectedItemOrService.find((v) => v.item === item);
              return {
                item,
                quantity: existingItem?.quantity ?? 1,
              };
            });
            setValue("serviceSchedules.expectedItemOrService", transformedItems);
            trigger("serviceSchedules.expectedItemOrService");
          }
        }}
        options={groupContainersBySubWasteType(
          (subContractorContainers.length > 0 ? subContractorContainers : itemsOptions)
            .filter((item) =>
              formData.serviceType === SERVICE_TYPES.MEDICAL_WASTE
                ? item.subWasteType !== "Paper Shredding"
                : item.subWasteType === "Paper Shredding"
            )
        )}
        isRequired={true}
        id="expected-items-services-ssr"
        styles="flex flex-col w-full gap-1 min-h-9"
        margin="0"
      />
    </div>
  </div>
  
  {!isReadOnly && errors.serviceSchedules?.expectedItemOrService && (
    <p className="text-red-500 text-sm mt-1">{errors.serviceSchedules.expectedItemOrService.message}</p>
  )}

  {formData.expectedItemOrService?.length > 0 && (
    <div className="mb-4 flex flex-col gap-4">
      {formData.expectedItemOrService.map((itemObj, itemIndex) => (
        <div key={itemObj.item} className="flex items-center">
          <span className="text-base w-1/3 text-inputLabel truncate whitespace-nowrap max-h-9 overflow-hidden">
            {itemsMap?.[itemObj.item]?.length > 40
              ? itemsMap?.[itemObj.item]
              : itemsMap?.[itemObj.item]}
          </span>
          <div className="relative w-2/3">
            <input
              min="1"
              max="999"
              value={itemObj.quantity || 1}
              onChange={(e) => {
				console.log("keepContainer",KeepContainers);
				
                if (isReadOnly&&KeepContainers) return;
                const newQuantity = Math.min(Math.max(1, Number(e.target.value)), 999);
                const updatedItems = [...formData.expectedItemOrService];
                updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
                setValue("serviceSchedules.expectedItemOrService", updatedItems);
                trigger("serviceSchedules.expectedItemOrService");
              }}
              disabled={isReadOnly || !hasSubcontractorSelected}
              className="p-2 pr-8 w-full pl-3 text-left text-sm bg-inputBg rounded-full outline-none focus:ring-1 focus:ring-dashInActiveBtnText appearance-none"
            />

            {!isReadOnly && hasSubcontractorSelected && (
              <>
                {/* Increase Button (Up Arrow) */}
                <button
                  type="button"
                  onClick={() => {
                    const newQuantity = Math.min((itemObj.quantity || 1) + 1, 999);
                    const updatedItems = [...formData.expectedItemOrService];
                    updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
                    setValue("serviceSchedules.expectedItemOrService", updatedItems);
                    trigger("serviceSchedules.expectedItemOrService");
                  }}
                  className="absolute right-2 top-1 text-gray-500 hover:text-gray-700"
                >
                  <HiOutlineChevronUp className="w-4 h-4" />
                </button>

                {/* Decrease Button (Down Arrow) */}
                <button
                  type="button"
                  onClick={() => {
                    const newQuantity = Math.max((itemObj.quantity || 1) - 1, 1);
                    const updatedItems = [...formData.expectedItemOrService];
                    updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
                    setValue("serviceSchedules.expectedItemOrService", updatedItems);
                    trigger("serviceSchedules.expectedItemOrService");
                  }}
                  className="absolute right-2 bottom-1 text-gray-500 hover:text-gray-700"
                >
                  <HiOutlineChevronDown className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )}
</div>
					</div>
				</div>
			</div>
		);
	};
	const renderOperatingHours = (date = new Date()) => {
		const dayNo = date.getDay();
		const dayName = daysOfWeek[dayNo];
		if (!generatorData) return "N/A";
		const operatingHours = generatorData.workingHours[dayName];

		if (operatingHours?.closed) {
			return "Closed";
		}
		if (operatingHours?.open && operatingHours?.close) {
			return `${operatingHours.open} ${
				operatingHours?.lunchStart?.length ? `: ${operatingHours?.lunchStart}` : ""
			} -  ${operatingHours?.lunchEnd?.length ? `${operatingHours?.lunchStart} :` : ""} ${operatingHours.close}`;
		} else {
			return "N/A";
		}
	};
	const renderUpcomingOperatingHours = (date) => {
		if (typeof date === "string") {
			date = new Date(date);
		} else {
			console.log("String Not Found");
		}

		const currentDate = new Date(date);

		const dateUTC = new Date(date);

		const dayNo = dateUTC.getDay();

		const dayName = daysOfWeek[dayNo];

		if (!generatorData) return <p>N/A</p>;

		const operatingHours = generatorData?.workingHours[dayName] ?? null;

		if (operatingHours?.closed) {
			return <p className="text-red-500">Closed</p>;
		}
		if (operatingHours?.open && operatingHours?.close) {
			if (operatingHours?.lunchStart?.length && operatingHours?.lunchEnd?.length) {
				return (
					<>
						<p>
							{operatingHours.open} - {operatingHours?.lunchStart}
						</p>
						<p>
							{operatingHours?.lunchEnd} - {operatingHours.close}
						</p>
					</>
				);
			} else {
				return (
					<>
						<p>
							{operatingHours.open} - {operatingHours.close}
						</p>
					</>
					// <p>
					// 	{operatingHours.open} {operatingHours?.lunchStart?.length ? `: ${operatingHours?.lunchStart}` : ""} -
					// 	{operatingHours?.lunchEnd?.length ? `${operatingHours?.lunchStart} :` : ""} {operatingHours.close}
					// </p>
				);
			}
		} else {
			return <p>N/A</p>;
		}
	};

	const isUpdating = (prev, form) => {
		let isUpdating = false;
		if (!prev) {
			isUpdating = false;
		}
		if (!form) {
			isUpdating = false;
		}
		const prevData = prev ? { ...prev } : {};
		if (prevData.expectedItemOrService?.length > 0) {
			prevData.expectedItemOrService = prevData.expectedItemOrService.map((el) => ({
				item: el.item,
				quantity: el.quantity,
			}));
		}

		delete prev?.upcomingDates;
		const formData = form ? { ...form } : {};
		delete formData?.upcomingDates;
		if (formData.expectedItemOrService?.length > 0) {
			formData.expectedItemOrService = formData.expectedItemOrService.map((el) => ({
				item: el.item,
				quantity: el.quantity,
			}));
		}
		if (JSON.stringify(prevData) !== JSON.stringify(formData)) {
			isUpdating = true;
		} else {
			isUpdating = false;
		}

		return isUpdating;
	};
	const isUpdatingInstruction = () => {
		const form = watchInstructions();
		if (
			form.deliveryNote !== prevInstructions.deliveryNote ||
			form.locationOfWaste !== prevInstructions.locationOfWaste ||
			form.lockBoxCode !== prevInstructions.lockBoxCode ||
			form.parkingNote !== prevInstructions.parkingNote ||
			form.serviceInstructions !== prevInstructions.serviceInstructions ||
			form.octoConnectNote !== prevInstructions.octoConnectNote
		) {
			return true;
		} else {
			return false;
		}
	};

	let formatAdd = (transporter) => {
		let formattedAdd = "";
		transporter.billingAddress?.street?.trim()?.length
			? (formattedAdd += transporter.billingAddress?.street)
			: (formattedAdd = "");
		transporter.billingAddress?.suite?.trim()?.length && formattedAdd?.length
			? (formattedAdd += `, ${transporter.billingAddress?.suite}`)
			: (formattedAdd += transporter.billingAddress?.suite ?? "");
		transporter.billingAddress?.city?.trim()?.length && formattedAdd?.length
			? (formattedAdd += `, ${transporter.billingAddress?.city}`)
			: (formattedAdd += transporter.billingAddress?.city ?? "");
		transporter.billingAddress?.state?.trim()?.length && formattedAdd?.length
			? (formattedAdd += `, ${transporter.billingAddress?.state}`)
			: (formattedAdd += transporter.billingAddress?.state ?? "");
		transporter.billingAddress?.zipCode?.trim()?.length && formattedAdd?.length
			? (formattedAdd += ` ${transporter.billingAddress?.zipCode}`)
			: (formattedAdd += transporter.billingAddress?.zipCode ?? "");

		return formattedAdd.length ? formattedAdd : "--";
	};

	const fetchContractorData = async (transporterId) => {
		try {
			const transporterDoc = await getDoc(doc(db, COLLECTIONS.transporters, transporterId));
			const transporterMarketDoc = await getDoc(doc(db, COLLECTIONS.octoMarketUsers, transporterId));

			if (!transporterDoc.exists() || !transporterMarketDoc.exists()) {
				console.log("No such transporter!");
				return [];
			}

			setIsOctoMarketUser(true);

			const data = transporterDoc.data();
			const transporterMarketData = transporterMarketDoc.data();
			console.log("subData", { data, octoData: transporterMarketData });

			if (!transporterMarketData) return [];

			const contractorRelationships = transporterMarketData.connections || {};
			const acceptedRelationships = Object.entries(contractorRelationships).filter(
				([_, relationship]) => relationship.status === "accepted"
			);
			const contractorPromises = acceptedRelationships.map(async ([contractorId, relationship]) => {
				const contractorDoc = await getDoc(doc(db, COLLECTIONS.transporters, contractorId));

				if (!contractorDoc.exists()) return null;

				const contractorData = contractorDoc.data();
				return {
					id: contractorId,
					contractorDocid: contractorDoc.id,
					contractorName: contractorData.companyName ?? "--",
					address: formatAdd(contractorData),
					generalEmail: contractorData.generalEmail?.length > 0 ? contractorData.generalEmail : "--",
					phoneNumber: contractorData.phoneNumber ?? "--",
					website: contractorData.website?.length ? contractorData.website : "--",
					sharedGenerators: contractorData.allGens?.length ?? 0,
					startDate: relationship.startDate,
					status: relationship.status,
					transporterOctoId: contractorData.transporterOctoId,
				};
			});

			const contractors = await Promise.all(contractorPromises);
			return [
				...contractors.filter(Boolean),
				{
					id: transporterDoc.id,
					name: data.name ?? "--",
					address: formatAdd(data),
					generalEmail: data.generalEmail?.length > 0 ? data.generalEmail : "--",
					phoneNumber: data.phoneNumber ?? "--",
					website: data.website?.length ? data.website : "--",
					sharedGenerators: data.allGens?.length ?? 0,
					startDate: new Date(),
					status: "",
				},
			];
		} catch (error) {
			console.error("Error fetching contractor data:", error);
			return [];
		}
	};

	useEffect(() => {
		const loadSubcontractors = async () => {
			if (!user || !user.uid) return;
			console.log("userrrr", user);

			try {
				const subcontractors = await fetchContractorData(user.uid);
				console.log("subcontractors", subcontractors);
				setSubContractorData(subcontractors);
			} catch (error) {
				console.error("Error loading subcontractors:", error);
			}
		};

		loadSubcontractors();
	}, [user]);

	const handleSendToSubcontractor = async () => {
		if (!user || !user?.uid) return;
		try {
			const isValid = await trigger();
			if (!isValid) {
				console.log("Validation errors:", errors);
				return;
			}

			const formData = getValues();

			const serviceDuration = formData.serviceSchedules?.serviceDuration || "15";
			const weekdays =
				formData.serviceSchedules?.serviceFrequency?.type === "MTWM"
					? formData.serviceSchedules?.serviceFrequency?.days || []
					: [];

			const serviceRequest = {
				genId: generatorData.id,
				serviceFrequency: formData.serviceSchedules?.serviceFrequency?.type,
				weekdays: weekdays,
				serviceType: formData.serviceSchedules?.serviceType,
				requestedStartDate: formData.requestedStartDate,
				serviceDuration: serviceDuration,
				expectedItemsOrServices: formData.serviceSchedules?.expectedItemOrService || [],
				serviceNote: formData.serviceNote || "",
				subcontractorId: formData.selectedSubContractor.id,
				subContractorName: formData.selectedSubContractor.Cname,
				status: SERVICE_STATUS.PENDING,
				createdAt: new Date().toISOString(),
				timeStamp: new Date(),
				ssrId: Date.now().toString(),
				transporterName: transporterData.companyName,
				transporterId: user?.uid,
			};

			const transporterRef = doc(db, COLLECTIONS.transporters, formData.selectedSubContractor.id);
			const transporterDoc = await getDoc(transporterRef);

			if (transporterDoc.exists()) {
				let transporterData = transporterDoc.data();
				let sharedGenerators = transporterData.sharedGenerators || {};
				sharedGenerators.toMe = sharedGenerators.toMe || [];
				sharedGenerators.toMe.push(serviceRequest);
				await updateDoc(transporterRef, { sharedGenerators });
			} else {
				console.log("Transporter not found.");
				return;
			}

			const currentTransporterRef = doc(db, COLLECTIONS.transporters, user?.uid);
			const currentransporterDoc = await getDoc(currentTransporterRef);

			if (currentransporterDoc.exists()) {
				let transporterData = currentransporterDoc.data();
				let sharedGenerators = transporterData.sharedGenerators || {};

				if (!sharedGenerators.fromMe) {
					sharedGenerators.fromMe = [];
				}

				sharedGenerators.fromMe.push(serviceRequest);
				await updateDoc(currentTransporterRef, { sharedGenerators });

				setSentSubcontractorRequests((prev) => [serviceRequest, ...prev]);
				setActiveSentSSRs((prev) => [serviceRequest, ...prev]);

				//setSuccessMessage("Request successfully sent to the subcontractor!");
				showSuccessToastMessage(
					`Subcontractor Service Request sent to ${formData.selectedSubContractor.Cname} Successfully!`
				);
				setShowSSRForm(false);
				setTimeout(() => {
					resetFormForNewSSR();
				}, 300);
			} else {
				console.log("Transporter not found.");
			}
		} catch (error) {
			console.error("Error sending request:", error);
			showErrorToastMessage("Error sending request to subcontractor");
		}
	};

	const handleCancelCurrentSSR = async () => {
		if (!cancelReason) {
			showErrorToastMessage("Cancellation note is required.");
			return;
		}

		const ssrToCancel = sentSubcontractorRequests[currentSSRIndex];
		if (!ssrToCancel) {
			showErrorToastMessage("Cannot identify the SSR to cancel");
			return;
		}

		try {
			const currentTransporterRef = doc(db, COLLECTIONS.transporters, user?.uid);
			const transporterDoc = await getDoc(currentTransporterRef);

			if (transporterDoc.exists()) {
				const transporterData = transporterDoc.data();
				let sharedGenerators = transporterData.sharedGenerators || {};

				if (sharedGenerators.fromMe && sharedGenerators.fromMe.length) {
					const requestIndex = sharedGenerators.fromMe.findIndex((req) => req.ssrId === ssrToCancel.ssrId);

					if (requestIndex !== -1) {
						sharedGenerators.fromMe[requestIndex].status = SERVICE_STATUS.ACCEPTED;
						sharedGenerators.fromMe[requestIndex].cancellationNote = cancelReason;
						sharedGenerators.fromMe[requestIndex].cancelledAt = new Date().toISOString();

						await updateDoc(currentTransporterRef, { sharedGenerators });
						const updatedRequests = sentSubcontractorRequests.map((req) =>
							req.ssrId === ssrToCancel.ssrId
								? {
										...req,
										status: SERVICE_STATUS.CANCELLED,
										cancellationNote: cancelReason,
										cancelledAt: new Date().toISOString(),
								  }
								: req
						);

						setSentSubcontractorRequests(updatedRequests);
						setActiveSentSSRs((prevActive) => prevActive.filter((ssr) => ssr.ssrId !== ssrToCancel.ssrId));

						showSuccessToastMessage("Subcontractor request cancelled successfully");
					} else {
						showErrorToastMessage("Could not find the request to cancel");
					}
				}
			}

			document.getElementById(`delete-SSR`).close();
			setCancelReason("");
		} catch (error) {
			console.error("Error cancelling SSR:", error);
			showErrorToastMessage("Error cancelling subcontractor request");
		}
	};
	const resetFormForNewSSR = () => {
		setValue("selectedSubContractor", null);
		setValue("serviceSchedules.serviceFrequency.type", "");
		setValue("serviceSchedules.serviceType", "");
		setValue("serviceSchedules.serviceDuration", "15");
		setValue("serviceSchedules.expectedItemOrService", []);
		setValue("serviceNote", "");
		setValue("requestedStartDate", null);
	};

	if (!generatorData) return <Loader />;

	return (
		<div className="grid bg-white p-8 py-6 mb-6 rounded-cardRadii gap-2 w-full">
			<dialog id={`generator_address_not_found`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Generator Profile Not Setup</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>Generator profile is not setup properly. Please add service address to the profile.</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/admin/generators/${generatorData.id}/generator-profile`);
								}}
							>
								Go Back to Generator Profile
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<dialog id={`generator_not_contracted`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Generator Profile Not Setup</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>
								Generator profile is not marked as contracted. Please mark the generator as contracted to access this
								page.
							</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/admin/generators/${generatorData.id}/generator-profile`);
								}}
							>
								Go Back to Generator Profile
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<dialog id={`generator_marked_as_NIGO_or_parking`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">
							Generator Profile is marked as{" "}
							{generatorStatus.find((status) => status.value == generatorData?.generatorStatus)?.label}
						</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>
								Generator profile is marked as{" "}
								{generatorStatus.find((status) => status.value == generatorData?.generatorStatus)?.label}. Please update
								the generator status in order to continue scheduling.
							</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/admin/generators/${generatorData?.id}/generator-profile`);
								}}
							>
								Go Back to Generator Profile
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<dialog id={`transporter_not_octomarket_user`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Transporter Octomarket Profile Is Not Setup</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>Transporter Octomarket profile is not setup properly. Please setup the Octomarket profile.</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/market`);
								}}
							>
								Go to Octomarket
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<GeneratorInfoHeader generatorData={generatorData ?? {}} user={user} transporterName={transporterName} />
			<div className="rounded-xl overflow-clip">
				<AzureMapsProvider>
					<RouteAssignment
						allRoutes={allRoutes}
						selectedRoutes={selectedRouteIds}
						generatorData={generatorData}
						getValues={getValues}
						allGeneratorsData={allGeneratorsData}
						allTreatmentData={allTreatmentData}
						allVendorData={allVendorData}
						serviceSchedules={prevServiceSchedules}
						routeOptions={routeOptions}
					/>
				</AzureMapsProvider>
			</div>
			{activeSentSSRs.length > 0 && generatorData?.transporterId != user?.uid && (
				<div>
					<h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC]">Subcontractor Service Requests (SSR)</h6>

					{activeSentSSRs.map((ssr, index) => (
						<div key={ssr.ssrId || index} className="pb-4 ">
							{renderSSRForm(true, ssr)}
							{ssr.subcontractorId != user?.uid && (
								<div className="w-full flex justify-end p-2 gap-4">
									<button
										type="button"
										className="rounded-full px-4 py-2 text-sm border border-gray-500 hover:bg-gray-100 transition"
										onClick={() => {
											setCurrentSSRIndex(sentSubcontractorRequests.findIndex((r) => r.ssrId === ssr.ssrId));
											document.getElementById(`delete-SSR`).showModal();
										}}
									>
										Cancel
									</button>
									{console.log("ssr cancel", ssr)}
									<button
										type="button"
										className="rounded-full px-4 py-2 text-sm bg-primary-500 hover:bg-primary-500/90 text-white transition disabled:bg-cardTextGray"
										onClick={handleSendToSubcontractor}
										disabled
									>
										Send To Subcontractor
									</button>
								</div>
							)}
						</div>
					))}
				</div>
			)}
			<h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC]">Scope Of Work (SOW)</h6>
			<form className="flex flex-col gap-2">
				{(!generatorData.isSubContracted || generatorData?.transporterId != user?.uid) &&
					fields.map((field, index) => (
						<div key={field.id || Date.now() + Math.random()} className="border-b border-gray-100">
							<div className="flex gap-8 w-full ">
								<div className="w-1/2">
									<Controller
										name={`serviceSchedules.${index}.routeId`}
										control={control}
										rules={{ required: "Route is required" }}
										render={({ field: { onChange, value } }) => (
											<Dropdown
												label="Route"
												options={routeOptions}
												value={value}
												onChange={(e) => {
													onChange(e);
													trigger(`serviceSchedules.${index}.routeId`, { shouldFocus: true });
												}}
												isRequired={true}
											/>
										)}
									/>
									{errors.serviceSchedules?.[index]?.routeId && (
										<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].routeId.message}</p>
									)}
									<Controller
										name={`serviceSchedules.${index}.serviceFrequency.type`}
										control={control}
										rules={{ required: "Service Frequency is required" }}
										render={({ field: { onChange, value } }) => (
											<Dropdown
												label="Service Frequency"
												options={serviceFrequencyOptions}
												value={value}
												onChange={(e) => {
													onChange(e);
													trigger(`serviceSchedules.${index}.serviceFrequency.type`, { shouldFocus: true });
												}}
												isRequired={true}
												noCursor={field?.isWillCall}
												listHeight={"max-h-64"}
											/>
										)}
									/>
									{errors.serviceSchedules?.[index]?.serviceFrequency?.type && (
										<p className="text-red-500 text-sm mt-1">
											{errors.serviceSchedules[index].serviceFrequency.type.message}
										</p>
									)}
									{watchServiceSchedules[index]?.serviceFrequency?.type === "MTWM" && (
										<Controller
											name={`serviceSchedules.${index}.serviceFrequency.days`}
											control={control}
											rules={{ required: "Weekdays are required for multiple times weekly" }}
											render={({ field: { onChange, value } }) => (
												<div className="w-full flex">
													<p className="w-1/3 whitespace-nowrap truncate">Select Weekdays *</p>
													<div className="w-2/3">
														<MultiSelectRounded
															value={value}
															onChange={(e) => {
																onChange(e);
																if (watchServiceSchedules[index]?.serviceFrequency?.type === "MTWM") {
																	trigger(`serviceSchedules.${index}.serviceFrequency.days`, { shouldFocus: true });
																}
															}}
															options={weekdayOptions}
															id={`weekdays-input-${index}`}
															styles="flex flex-col w-full gap-1"
															margin="0"
														/>
													</div>
												</div>
											)}
										/>
									)}
									<div className="flex items-center justify-between my-4">
										<label htmlFor={`anchorDate-${index}`} className="truncate text-inputLabel font-normal">
											{field?.isWillCall ? "Will Call Date " : "Anchor Date "}*
										</label>
										<div className="w-2/3">
											<Controller
												name={`serviceSchedules.${index}.anchorDate`}
												control={control}
												rules={{
													required: "Anchor date is required.",
												}}
												render={({ field: { value, onChange } }) => (
													<CustomDatePicker
														selectedDate={value}
														setSelectedDate={(value) => {
															console.log({ value });
															onChange(value);
															trigger(`serviceSchedules.${index}.anchorDate`, { shouldFocus: true });
														}}
														label={"Anchor Date *"}
														startYear={new Date().getFullYear()}
														endYear={new Date().getFullYear() + 5}
														yearReversed={true}
														minDate={new Date()}
													/>
												)}
											/>
										</div>
									</div>
									{errors.serviceSchedules?.[index]?.anchorDate && (
										<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].anchorDate.message}</p>
									)}
								</div>
								<div className="w-1/2 ">
									<Controller
										name={`serviceSchedules.${index}.serviceType`}
										control={control}
										rules={{ required: "Service Type is required." }}
										render={({ field: { onChange, value } }) => (
											<Dropdown
												label="Service Type"
												id={`service-input-${index}`}
												options={serviceTypes.map((item) => {
													if (item.value === "HAZARDOUS_WASTE") {
														return {
															label: "Hazardous Waste",
															value: null,
															isDisabled: true,
														};
													}
													return {
														label: item.label,
														value: item.value,
													};
												})}
												value={value}
												onChange={(e) => {
													onChange(e);
													trigger(`serviceSchedules.${index}.serviceType`, { shouldFocus: true });
													if (
														!(
															(e === SERVICE_TYPES.PAPER_SHREDDING && value === SERVICE_TYPES.PAPER_SHREDDING) ||
															(e === SERVICE_TYPES.PAPER_SHREDDING &&
																value === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING) ||
															(e === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING &&
																value === SERVICE_TYPES.PAPER_SHREDDING) ||
															(e === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING &&
																value === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING)
														)
													) {
														setValue(`serviceSchedules.${index}.expectedItemOrService`, []);
													}
												}}
												isRequired={true}
												disabledBgColor="white"
												disabledTextColor="gray-300"
											/>
										)}
									/>
									{errors.serviceSchedules?.[index]?.serviceType && (
										<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].serviceType.message}</p>
									)}
									<Controller
										name={`serviceSchedules.${index}.serviceDuration`}
										control={control}
										rules={{ required: "Service Duration is required." }}
										render={({ field: { onChange, value } }) => (
											<Dropdown
												label="Service Duration"
												options={serviceDurationOptions}
												value={value}
												onChange={(e) => {
													onChange(e);
													trigger(`serviceSchedules.${index}.serviceDuration`, { shouldFocus: true });
												}}
												isRequired={true}
											/>
										)}
									/>
									{errors.serviceSchedules?.[index]?.serviceType && (
										<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].serviceType.message}</p>
									)}
									<Controller
										name={`serviceSchedules.${index}.expectedItemOrService`}
										control={control}
										rules={{
											required: "Expected Container is required.",
											validate: (value) => {
												return (
													value.every((item) => item.quantity >= 1 && item.quantity <= 999) ||
													"Quantity must be between 1 and 999"
												);
											},
										}}
										render={({ field: { value, onChange } }) => (
											<div className="w-full flex flex-col gap-4">
												<div className="w-full flex">
													<p className="w-1/3 whitespace-nowrap truncate text-inputLabel font-normal">
														Expected Container(s) *
													</p>
													<div className="w-2/3">
														<MultiSelectRounded
															isDisabled={!formValues.serviceSchedules[index].serviceType}
															value={value.map((v) => v.item)}
															onChange={(selectedItems) => {
																const transformedItems = selectedItems.map((item) => {
																	const existingItem = value.find((v) => v.item === item);
																	return {
																		item,
																		quantity: existingItem ? existingItem.quantity : 1,
																	};
																});
																onChange(transformedItems);
																trigger(`serviceSchedules.${index}.expectedItemOrService`, { shouldFocus: true });
															}}
															options={groupContainersBySubWasteType(
																itemsOptions.filter((item) =>
																	formValues.serviceSchedules[index].serviceType === SERVICE_TYPES.MEDICAL_WASTE
																		? item.subWasteType !== "Paper Shredding"
																		: item.subWasteType === "Paper Shredding"
																)
															)}
															isRequired={true}
															id={`expected-items-services-${index}`}
															styles="flex flex-col w-full gap-1 min-h-9"
															margin="0"
														/>
													</div>
												</div>
												{value?.length > 0 && value && value?.[0]?.item?.length > 0 && (
													<div className="mb-4 flex flex-col gap-4">
														{value.map((itemObj, itemIndex) => (
															<div key={itemObj.item} className="flex items-center ">
																<span className="text-base w-1/3 text-inputLabel truncate whitespace-nowrap max-h-9 overflow-hidden">
																	{itemsMap?.[itemObj.item]?.length > 40
																		? itemsMap?.[itemObj.item]
																		: itemsMap?.[itemObj.item]}
																</span>
																<div className="relative w-2/3">
																	<input
																		//type="number"
																		min="1"
																		max="999"
																		value={itemObj.quantity}
																		onChange={(e) => {
																			const newQuantity = Math.min(Math.max(1, Number(e.target.value)), 999);
																			const updatedItems = [...value];
																			updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
																			onChange(updatedItems);
																		}}
																		className="p-2 pr-8 w-full pl-3 text-left text-sm bg-inputBg rounded-full outline-none focus:ring-1 focus:ring-dashInActiveBtnText appearance-none"
																	/>

																	{/* Increase Button (Up Arrow) */}
																	<button
																		type="button"
																		onClick={() => {
																			const newQuantity = Math.min(itemObj.quantity + 1, 999);
																			const updatedItems = [...value];
																			updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
																			onChange(updatedItems);
																		}}
																		className="absolute right-2 top-1 text-gray-500 hover:text-gray-700"
																	>
																		<HiOutlineChevronUp className="w-4 h-4" />
																	</button>

																	{/* Decrease Button (Down Arrow) */}
																	<button
																		type="button"
																		onClick={() => {
																			const newQuantity = Math.max(itemObj.quantity - 1, 1);
																			const updatedItems = [...value];
																			updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
																			onChange(updatedItems);
																		}}
																		className="absolute right-2 bottom-1 text-gray-500 hover:text-gray-700"
																	>
																		<HiOutlineChevronDown className="w-4 h-4" />
																	</button>
																</div>
															</div>
														))}
													</div>
												)}
											</div>
										)}
									/>
									{errors.serviceSchedules?.[index]?.expectedItemOrService && (
										<p className="text-red-500 text-sm mt-1">
											{errors.serviceSchedules[index].expectedItemOrService?.message}
										</p>
									)}
								</div>
							</div>

							{watchServiceSchedules[index]?.serviceFrequency?.type === "WC" &&
							watchServiceSchedules[index]?.anchorDate?.length > 0 ? (
								<div className="mb-4 w-full">
									<h6 className="font-medium pb-2">Next Service</h6>
									<div className="flex gap-2 flex-wrap">
										<div className="items-center bg-gray-100 rounded-full px-8 py-1 text-sm text-gray-700 mr-2 mb-2">
											<p>{dateFormatter(watchServiceSchedules[index].anchorDate)}</p>
											{renderUpcomingOperatingHours(watchServiceSchedules[index].anchorDate)}
										</div>
									</div>
								</div>
							) : (
								watchServiceSchedules[index]?.upcomingDates?.length > 0 && (
									<div className="mb-4 w-full">
										<h6 className="font-medium pb-2">Next 6 Services If Saved</h6>
										<div className="flex gap-2 flex-wrap">
											{watchServiceSchedules[index].upcomingDates.map((date, dateIndex) => {
												return (
													<div
														key={dateIndex}
														className="items-center bg-gray-100 rounded-full px-5 py-1 text-sm text-gray-700 mr-2 mb-2"
													>
														<p>
															{watchServiceSchedules[index].serviceFrequency.type === "MTWM"
																? formatUtcDateString(date)
																: dateFormatter(date)}
														</p>
														{renderUpcomingOperatingHours(
															watchServiceSchedules[index].serviceFrequency.type === "MTWM"
																? formatUtcDateString(date)
																: dateFormatter(date)
														)}
													</div>
												);
											})}
										</div>
									</div>
								)
							)}

							{
								<div className="w-full flex justify-end p-2 gap-5">
									{fields.length > 0 && (
										<button
											type="button"
											className="rounded-full px-4 py-1 min-w-40 text-sm border border-black hover:bg-cardTextGray hover:bg-opacity-10 "
											onClick={async () => {
												if (watchServiceSchedules[index]?.id) {
													document.getElementById(`delete-schedule-services-${index}`).showModal();
												} else {
													remove(index);
												}
											}}
										>
											{currentServiceSchedules.find((el) => el.id === watchServiceSchedules[index]?.id)
												?.isProcessing ? (
												<Loader height="h-8 pt-1.5" />
											) : (
												"Remove service schedule"
											)}
										</button>
									)}
									<button
										type="button"
										disabled={
											!isUpdating(prevServiceSchedules[index], formValues.serviceSchedules[index]) || disableButton
										}
										className={`p-2 flex items-center justify-center px-4 min-w-40 bg-primary-500 hover:bg-primary-500/90 disabled:bg-cardTextGray text-white rounded-full text-center `}
										onClick={async () => {
											const res = await trigger(`serviceSchedules.${index}`, { shouldFocus: true });
											if (!res) return;
											setDisableButton(true);
											handleSave(index);
										}}
									>
										{currentServiceSchedules.find((el) => el.id === formValues?.serviceSchedules[index]?.id)
											?.isProcessing ? (
											<Loader height="h-8 pt-1.5" />
										) : formValues?.serviceSchedules[index]?.id ? (
											"Update"
										) : (
											"Save"
										)}
									</button>
								</div>
							}
							<dialog id={`delete-schedule-services-${index}`} className="modal">
								<div className="modal-box">
									<div>
										{/* if there is a button in form, it will close the modal */}
										<button
											className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
											type="button"
											onClick={() => {
												document.getElementById(`delete-schedule-services-${index}`).close();
											}}
										>
											✕
										</button>
									</div>
									<h3 className="font-bold text-lg">Are you sure?</h3>
									<div className="flex py-5 gap-5 flex-col">
										<p className="">Proceeding with this operation will affect pending services.</p>
										<p className="text-sm">
											On confirmation the pending services will be deleted and this schedule will be removed. However
											this operation will not delete any complete, inprogress or cancelled services. This operation
											cannot be undone.
										</p>
										<p>Enter Note for Cancellation *</p>
										<textarea
											rows={3}
											onChange={(e) => setCancelReason(e.target.value)}
											className={` w-full text-cardTextGray bg-inputBg border-none rounded-[20px] py-2 h-28 px-2 leading-tight focus:outline-none  focus:ring-1 focus:ring-dashInActiveBtnText`}
										/>
									</div>
									<div className="flex w-full justify-between">
										<button
											className="btn btn-error btn-sm"
											type="button"
											onClick={() => {
												if (!cancelReason) {
													showErrorToastMessage("Cancellation note is required.");
													return;
												}
												deleteSchedule(field, index);
												document.getElementById(`delete-schedule-services-${index}`).close();
											}}
										>
											Remove Schedule
										</button>
										<button
											type="button"
											className="btn btn-primary btn-sm"
											onClick={() => {
												document.getElementById(`delete-schedule-services-${index}`).close();
											}}
										>
											Keep Schedule
										</button>
									</div>
								</div>
							</dialog>
						</div>
					))}

				<>
					{activeSentSSRs.length > 0 && generatorData?.transporterId == user?.uid && (
						<div>
							<h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC]">
								Subcontractor Service Requests (SSR)
							</h6>

							{activeSentSSRs.map((ssr, index) => (
								<div key={ssr.ssrId || index} className="pb-4 ">
									{renderSSRForm(true, ssr)}
									{ssr.subcontractorId != user?.uid && (
										<div className="w-full flex justify-end p-2 gap-4">
											<button
												type="button"
												className="rounded-full px-4 py-2 text-sm border border-gray-500 hover:bg-gray-100 transition"
												onClick={() => {
													setCurrentSSRIndex(sentSubcontractorRequests.findIndex((r) => r.ssrId === ssr.ssrId));
													document.getElementById(`delete-SSR`).showModal();
												}}
											>
												Cancel
											</button>
											{console.log("ssr cancel", ssr)}
											<button
												type="button"
												className="rounded-full px-4 py-2 text-sm bg-primary-500 hover:bg-primary-500/90 text-white transition disabled:bg-cardTextGray"
												onClick={handleSendToSubcontractor}
												disabled
											>
												Send To Subcontractor
											</button>
										</div>
									)}
								</div>
							))}
						</div>
					)}
					{showSSRFrom && (
						<div className="mb-8 pb-4 ">
							{renderSSRForm(false, null)}
							<div className="w-full flex justify-end p-2 gap-4">
								<button
									type="button"
									className="rounded-full px-4 py-2 text-sm border border-gray-500 hover:bg-gray-100 transition"
									onClick={() => setShowSSRForm(false)}
								>
									Cancel
								</button>
								<button
									type="button"
									className="rounded-full px-4 py-2 text-sm bg-primary-500 hover:bg-primary-500/90 text-white transition"
									onClick={handleSendToSubcontractor}
								>
									Send To Subcontractor
								</button>
							</div>
						</div>
					)}

					<dialog id={`delete-SSR`} className="modal">
						<div className="modal-box">
							<div>
								<button
									className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
									type="button"
									onClick={() => {
										document.getElementById(`delete-SSR`).close();
										setCancelReason("");
									}}
								>
									✕
								</button>
							</div>
							<h3 className="font-bold text-lg">Are You Sure ?</h3>
							<div className="flex py-5 gap-5 flex-col">
								<p className="">Proceeding with this operation will cancel the Subcontractor Service Request</p>
								<p>Enter Note for Cancellation *</p>
								<textarea
									rows={3}
									value={cancelReason}
									onChange={(e) => setCancelReason(e.target.value)}
									className="w-full text-cardTextGray bg-inputBg border-none rounded-[20px] py-2 h-28 px-2 leading-tight focus:outline-none focus:ring-1 focus:ring-dashInActiveBtnText"
								/>
							</div>
							<div className="flex w-full justify-between">
								<button className="btn btn-error btn-sm" type="button" onClick={handleCancelCurrentSSR}>
									Cancel Request
								</button>
								<button
									type="button"
									className="btn btn-primary btn-sm"
									onClick={() => {
										document.getElementById(`delete-SSR`).close();
										setCancelReason("");
									}}
								>
									Keep Request
								</button>
							</div>
						</div>
					</dialog>
				</>

				<div className="grid items-center justify-center relative">
					{generatorData.transporterId == user?.uid && renderSSRButton()}
					<div className="ml-auto absolute top-0 right-0">{renderAddMoreServiceButtons()}</div>
				</div>
			</form>

			<div className="py-5">
				<div className="flex flex-col gap-2">
					<div className="w-full grid gap-3">
						<h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC]">Reminders/Notifications</h6>
						<div className="flex flex-col sm:flex-row pt-1 items-center gap-6">
							<label className="text-cardTextGray">Service Day Notifications</label>
						</div>
						<div className="flex flex-col gap-6 sm:flex-row items-center">
							<label htmlFor="24-hour-notice" className="flex items-center text-gray-500 gap-5">
								<input
									type="checkbox"
									name=""
									id="24-hour-notice"
									className="w-4 h-4 bg-white"
									defaultChecked={generatorData?.notifiPref24Hours}
									onChange={(e) => {
										if (e.currentTarget?.checked) {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPref24Hours: true });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										} else {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPref24Hours: false });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										}
									}}
								/>
								<p>24 Hour Advance Notice</p>
							</label>
							<label htmlFor="same-day-notice" className="flex items-center text-gray-500 gap-5">
								<input
									type="checkbox"
									name=""
									id="same-day-notice"
									className="w-4 h-4 bg-white"
									defaultChecked={generatorData?.notifiPrefServiceDay}
									onChange={(e) => {
										if (e.currentTarget.checked) {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPrefServiceDay: true });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										} else {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPrefServiceDay: false });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										}
									}}
								/>
								<p>Same Day Notice</p>
							</label>
						</div>
					</div>
				</div>
			</div>
			<form
				onSubmit={instructionHandleSubmit(instructionSubmitHandler)}
				ref={instructionsSectionRef}
				className="grid gap-2"
			>
				<div>
					<h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC] mb-2">
						Generator Service Instructions{" "}
						<span className="text-sm text-cardTextGray">(Instructions appear in OCTO Field App)</span>
					</h6>
					<div className="w-full flex flex-col md:flex-row gap-8">
						<div className="w-1/2">
							<Controller
								name="deliveryNote"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea value={value} onChange={onChange} label="Delivery Note (DEL)" />
								)}
							/>
							{errors.deliveryNote && <p className="text-red-500 text-sm mt-1">{errors.deliveryNote.message}</p>}
							<Controller
								name="parkingNote"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea value={value} onChange={onChange} label="Parking Note (PRK)" />
								)}
							/>
							{errors.parkingNote && <p className="text-red-500 text-sm mt-1">{errors.parkingNote.message}</p>}
							<Controller
								name="locationOfWaste"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea value={value} onChange={onChange} label="Location Of Waste (LOC)" />
								)}
							/>
							{errors.locationOfWaste && <p className="text-red-500 text-sm mt-1">{errors.locationOfWaste.message}</p>}
						</div>
						<div className="w-1/2">
							<Controller
								name="lockBoxCode"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea value={value} onChange={onChange} label="Access Code" />
								)}
							/>
							{errors.lockBoxCode && <p className="text-red-500 text-sm mt-1">{errors.lockBoxCode.message}</p>}
							<Controller
								name="serviceInstructions"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea value={value} onChange={onChange} label="Service Instructions" />
								)}
							/>
							{errors.serviceInstruction && (
								<p className="text-red-500 text-sm mt-1">{errors.serviceInstruction.message}</p>
							)}
							<Controller
								name="octoConnectNote"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea value={value} onChange={onChange} label="OCTO Connect" placeholder={"Contractor's Note"} />
								)}
							/>
							{errors.octoConnectNote && <p className="text-red-500 text-sm mt-1">{errors.octoConnectNote.message}</p>}
						</div>
					</div>
				</div>
				<div className="flex">
					<button
						type="submit"
						disabled={!isUpdatingInstruction()}
						className="btn btn-primary btn-md text-base ml-auto disabled:bg-cardTextGray disabled:text-white"
					>
						Save
					</button>
				</div>
			</form>
			<GeneratorUpcomingServices generatorData={generatorData} transporterId={user?.uid} />
			<GeneratorPreviousServices generatorData={generatorData} transporterId={user?.uid} />
		</div>
	);
};

GeneratorRoutes.propTypes = {
	generatorData: PropTypes.object,
	onClickBack: PropTypes.func,
	onNextClick: PropTypes.func,
};

export default GeneratorRoutes;

function calculateUpcomingDates(schedule) {
	if (schedule.anchorDate && schedule.serviceFrequency) {
		let calculatedDates = [];
		if (schedule.serviceFrequency.type === "WC") {
			calculatedDates = [];
		} else if (schedule.serviceFrequency.type === "MTWM") {
			if (schedule.serviceFrequency.days.length > 0) {
				const anchorDate = new Date(schedule.anchorDate);
				const anchorUTC = new Date(Date.UTC(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate()));

				calculatedDates = getUpcomingWeekdays(anchorUTC, schedule.serviceFrequency.days, 6);
			}
		} else {
			calculatedDates = getUpcomingDates(new Date(schedule.anchorDate), schedule.serviceFrequency.type, 6);
		}
		return calculatedDates;
	}
	return [];
}
